const { getReport, rateLimited } = require('../lib/report');
const { clientIp } = require('./raio-x');

// WhatsApp comercial da Beekeeper (DDI + DDD + número). WHATSAPP_NUMBER sobrescreve.
const DEFAULT_WHATSAPP = '5562982771309';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (rateLimited('lead:' + clientIp(req))) return res.status(429).json({ error: 'Muitas tentativas. Tente de novo em alguns minutos.' });

  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 80);
  const whatsapp = String(body.whatsapp || '').replace(/\D/g, '');
  if (name.length < 2) return res.status(400).json({ error: 'Informe seu nome.' });
  if (whatsapp.length < 10 || whatsapp.length > 13) return res.status(400).json({ error: 'Informe um WhatsApp válido, com DDD.' });

  let report;
  try {
    report = await getReport(body.query);
  } catch (err) {
    console.error('lead', err.message);
    return res.status(502).json({ error: 'Não conseguimos consultar o Google agora. Tente de novo em instantes.' });
  }
  if (!report) return res.status(404).json({ error: 'Empresa não encontrada.' });

  const lead = {
    name, whatsapp,
    business: report.business.name,
    address: report.business.address,
    score: report.score.total,
    demo: report.demo,
    at: new Date().toISOString(),
  };
  let delivered = false;
  if (process.env.LEAD_WEBHOOK_URL) {
    try {
      const r = await fetch(process.env.LEAD_WEBHOOK_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead),
      });
      delivered = r.ok;
      if (!r.ok) console.error('lead webhook', r.status);
    } catch (err) {
      console.error('lead webhook', err.message);
    }
  }
  // Sem webhook (ou se ele falhar) o lead fica só no log do servidor.
  if (!delivered) console.log('LEAD', JSON.stringify(lead));

  res.status(200).json({
    plan: report.plan,
    whatsapp: (process.env.WHATSAPP_NUMBER || DEFAULT_WHATSAPP).replace(/\D/g, '') || null,
  });
};
