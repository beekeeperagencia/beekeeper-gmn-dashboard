// Monta o relatório, com cache e limite por visitante. Ambos ficam em memória:
// em hospedagem serverless valem por instância, então são proteção de melhor
// esforço. O teto de gasto de verdade deve ser configurado no Google Cloud.

const { fetchProfile } = require('./places');
const { calcScore, buildPlan, strength } = require('./score');

const CACHE_TTL = 3 * 24 * 60 * 60 * 1000;
const RATE_MAX = 10;
const RATE_WINDOW = 60 * 60 * 1000;
const cache = new Map();
const hits = new Map();

function rateLimited(ip, now = Date.now()) {
  const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  return false;
}

function cleanQuery(q) {
  return String(q || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

async function getReport(rawQuery) {
  const query = cleanQuery(rawQuery);
  if (query.length < 3) return null;
  const k = query.toLowerCase();
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.report;

  const profile = await fetchProfile(query);
  if (!profile) return null;
  const { business, competitors, demo } = profile;
  const score = calcScore(business, competitors);
  const plan = buildPlan(business, score);
  const ranking = [{ name: business.name, rating: business.rating, reviewCount: business.reviewCount, self: true }, ...competitors]
    .sort((a, b) => strength(b) - strength(a))
    .map((p, i) => ({ position: i + 1, ...p }));

  const report = { query, demo, business, score, plan, ranking };
  cache.set(k, { at: Date.now(), report });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return report;
}

// Versão gratuita: nota, critérios, 3 maiores problemas (sem o passo a passo)
// e o ranking. O plano completo só sai depois do cadastro do lead.
function publicView(r) {
  const b = r.business;
  return {
    query: r.query,
    demo: r.demo,
    business: { name: b.name, address: b.address, category: b.category, rating: b.rating, reviewCount: b.reviewCount, mapsUrl: b.mapsUrl },
    score: { total: r.score.total, level: r.score.level, criteria: r.score.criteria.map(({ key, label, max, earned }) => ({ key, label, max, earned })) },
    problems: r.plan.slice(0, 3).map(({ key, title, why, points }) => ({ key, title, why, points })),
    planSize: r.plan.length,
    pointsAvailable: r.plan.reduce((s, p) => s + p.points, 0),
    ranking: r.ranking,
  };
}

module.exports = { getReport, publicView, rateLimited, cleanQuery };
