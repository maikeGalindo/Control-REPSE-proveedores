// Netlify Function (v2): consulta el Padrón REPSE de la STPS SOLO por nombre del proveedor.
// No recibe, usa ni devuelve RFC. Basada en app/api/repse/route.ts (lyrba-tools-repse-scan).
// Sin dependencias; requiere Node 18+.
const BASE = "https://repse.stps.gob.mx"
const CONSULTA_URL = `${BASE}/`
const BUSCADOR_URL = `${BASE}/busca_razon_social`
// Detalle: POST multipart con razon_social = id que devuelve el buscador (no es data.id).
const DETALLE_URL = `${BASE}/buscar-padron`
const MAX_CANDIDATOS = 5
const PRESUPUESTO_MS = 8500 // las funciones síncronas de Netlify cortan a ~10 s por defecto
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  })

async function fetchT(url, init, ms) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" })
  } finally {
    clearTimeout(t)
  }
}

async function getSession() {
  const res = await fetchT(BASE + "/", { headers: { "User-Agent": UA, Accept: "text/html" } }, 5000)
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ")
  const html = await res.text()
  const m =
    html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']csrf-token["']/i)
  return { cookie, csrf: m?.[1] ?? "" }
}

const xhrHeaders = (s) => ({
  "User-Agent": UA,
  Accept: "application/json, text/javascript, */*; q=0.01",
  "X-Requested-With": "XMLHttpRequest",
  Referer: BASE + "/",
  ...(s.csrf ? { "X-CSRF-TOKEN": s.csrf } : {}),
  ...(s.cookie ? { Cookie: s.cookie } : {}),
})

const clean = (s) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
const norm = (s) =>
  clean(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[.,;]/g, "").replace(/\s+/g, " ").trim()

// Quita la forma societaria al final (S.A. de C.V., S. de R.L. de C.V., S.A.P.I., S.A.S., A.C., etc.)
const SOC = / (?:(?:SAPI|SAB|SAS|SA|SC DE RL|SC|SRL|S DE RL|SPR DE RL|AC)(?: DE CV)?|DE CV)$/
const sinSociedad = (s) => {
  let n = norm(s)
  for (let i = 0; i < 2 && SOC.test(n); i++) n = n.replace(SOC, "").trim()
  return n
}

function parseFecha(s) {
  if (!s) return null
  const d = new Date(String(s).trim().replace(" ", "T"))
  return isNaN(d.getTime()) ? null : d
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405)

  // Solo desde la propia página (evita que otros sitios usen la función como proxy).
  const site = req.headers.get("sec-fetch-site")
  if (site && site !== "same-origin") return json({ error: "Origen no permitido." }, 403)

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: "Cuerpo inválido." }, 400)
  }
  const razonSocial = String(body?.razonSocial ?? "").trim()
  if (razonSocial.length < 3) return json({ error: "Proporciona el nombre del proveedor." }, 400)

  const term = razonSocial
  const t0 = Date.now()
  const base = {
    outcome: "manual_requerido",
    reachable: false,
    consultaUrl: CONSULTA_URL,
    razonSocial: razonSocial,
    consultadoEn: new Date().toISOString(),
    message: "",
  }

  try {
    let session = { cookie: "", csrf: "" }
    try {
      session = await getSession()
    } catch {
      /* se intenta el buscador aunque no haya sesión */
    }

    const q = encodeURIComponent(term)
    const res = await fetchT(`${BUSCADOR_URL}?term=${q}&_type=query&q=${q}`, { headers: xhrHeaders(session) }, 6000)
    base.reachable = true
    if (!res.ok)
      return json({ ...base, message: `El portal respondió con estado ${res.status}. Verifica manualmente en la consulta oficial.` })

    const busqueda = await res.json()
    const items = Array.isArray(busqueda?.results) ? busqueda.results : []
    if (items.length === 0)
      return json({ ...base, outcome: "no_encontrado", message: "No se encontraron resultados en el Padrón REPSE para esa búsqueda." })

    // Detalle de candidatos: se acepta la coincidencia exacta del nombre (sin acentos, mayúsculas
    // ni puntuación); si no la hay, solo se acepta si es el único resultado y se marca aproximada.
    const objetivo = norm(razonSocial)
    const objetivoBase = sinSociedad(razonSocial)
    const detalles = []
    for (const it of items.slice(0, MAX_CANDIDATOS)) {
      if (Date.now() - t0 > PRESUPUESTO_MS) break
      const fd = new FormData()
      fd.append("razon_social", String(it.id))
      const r = await fetchT(DETALLE_URL, { method: "POST", body: fd, headers: xhrHeaders(session) }, 5000)
      if (!r.ok) continue
      const j = await r.json()
      const d = j?.data
      if (!j?.success || !d) continue
      detalles.push({ d, j })
      if (norm(d.razon_social) === objetivo) break // coincidencia exacta: no hace falta seguir
    }
    const vistos = detalles.map((x) => clean(x.d.razon_social))

    let elegido = detalles.find((x) => norm(x.d.razon_social) === objetivo) ?? null
    let coincidencia = "exacta"
    if (!elegido) {
      // Igual sin la forma societaria: solo se acepta si es única (si hay dos, es ambiguo).
      const sinForma = detalles.filter((x) => sinSociedad(x.d.razon_social) === objetivoBase)
      if (sinForma.length === 1) {
        elegido = sinForma[0]
        coincidencia = "sin_forma_societaria"
      }
    }
    if (!elegido && items.length === 1 && detalles.length === 1) {
      elegido = detalles[0]
      coincidencia = "aproximada"
    }

    if (!elegido) {
      return json({
        ...base,
        candidatos: vistos.length ? vistos : items.slice(0, MAX_CANDIDATOS).map((i) => clean(i.text)),
        message:
          "Hay resultados en el Padrón, pero ninguno con el nombre exacto. Ajusta el nombre en la hoja para que coincida con el del padrón o verifica manualmente.",
      })
    }

    const { d, j } = elegido
    const vence = parseFecha(d.fecha_vencimiento_registro)
    const vigente = vence ? vence.getTime() > Date.now() : undefined
    const acts = j?.actividades ?? d.actividades ?? []
    return json({
      ...base,
      outcome: "encontrado",
      coincidencia,
      razonSocial: clean(d.razon_social) || base.razonSocial,
      registro: {
        estatus: vigente === undefined ? "Aparece en el Padrón" : vigente ? "Vigente" : "Vencido",
        folio: d.folio != null ? clean(d.folio) : undefined,
        vigencia: clean(d.fecha_vencimiento_registro).slice(0, 10) || undefined,
        fechaRegistro: clean(d.fecha_registro).slice(0, 10) || undefined,
        entidad: clean(d.entidad) || undefined,
        municipio: clean(d.municipio) || undefined,
        numAviso: d.num_emi != null ? `${clean(d.abreviatura)}${clean(d.num_emi)}` : undefined,
        actividades: Array.isArray(acts) ? acts.map((a) => clean(a?.descripcion)).filter(Boolean) : [],
      },
      message:
        vigente === false
          ? "El registro aparece en el Padrón pero su vigencia ya venció."
          : coincidencia === "aproximada"
            ? "Único resultado del Padrón; el nombre no coincide exactamente. Confírmalo."
            : coincidencia === "sin_forma_societaria"
              ? "Registro localizado; el nombre coincide sin considerar la forma societaria (S.A. de C.V., etc.)."
              : "Registro localizado en el Padrón REPSE.",
    })
  } catch {
    return json({ ...base, message: "No fue posible consultar el portal del Padrón REPSE en este momento. Verifica manualmente en la consulta oficial." })
  }
}
