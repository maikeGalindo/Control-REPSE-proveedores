// Oculta la URL del Apps Script de avisos. Variable de entorno: AVISOS_URL
exports.handler = async () => {
  const hdr = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=120', 'X-Robots-Tag': 'noindex' };
  try {
    if (!process.env.AVISOS_URL) return { statusCode: 200, headers: hdr, body: JSON.stringify({ ok: false }) };
    const r = await fetch(process.env.AVISOS_URL);
    return { statusCode: 200, headers: hdr, body: await r.text() };
  } catch (e) {
    return { statusCode: 200, headers: hdr, body: JSON.stringify({ ok: false }) };
  }
};
