const { getReport, publicView, rateLimited } = require('../lib/report');

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anon').split(',')[0].trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  if (rateLimited(clientIp(req))) return res.status(429).json({ error: 'Muitas consultas seguidas. Tente de novo em alguns minutos.' });
  try {
    const report = await getReport(req.query.q);
    if (!report) return res.status(404).json({ error: 'Não encontramos essa empresa no Google. Tente com nome e cidade.' });
    res.status(200).json(publicView(report));
  } catch (err) {
    console.error('raio-x', err.message);
    res.status(502).json({ error: 'Não conseguimos consultar o Google agora. Tente de novo em instantes.' });
  }
};
module.exports.clientIp = clientIp;
