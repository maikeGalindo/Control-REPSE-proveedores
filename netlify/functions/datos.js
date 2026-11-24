// Pide los datos a un Apps Script de tu hoja (sin Google Cloud, sin costo).
// Variables de entorno en Netlify: DATOS_URL (URL de la app web) y DATOS_KEY (clave secreta)
exports.handler = async () => {
  const hdr = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60', 'X-Robots-Tag': 'noindex' };
  try {
    const r = await fetch(process.env.DATOS_URL + '?k=' + encodeURIComponent(process.env.DATOS_KEY || ''));
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return { statusCode: 200, headers: hdr, body: JSON.stringify(j) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: { ...hdr, 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'No se pudo leer la hoja' }) };
  }
};
