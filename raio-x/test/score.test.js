const test = require('node:test');
const assert = require('node:assert');
const { calcScore, buildPlan } = require('../lib/score');
const { fetchDemo } = require('../lib/places');
const { getReport, publicView } = require('../lib/report');

const NOW = Date.parse('2026-01-15T12:00:00Z');
const strong = {
  name: 'Forte', rating: 4.9, reviewCount: 400, photoCount: 10, hasHours: true,
  website: 'https://x.com', phone: '1', primaryType: 'dentist', types: ['dentist', 'a', 'b'],
  latestReviewAt: '2026-01-10T00:00:00Z',
};
const rivals = [{ name: 'A', rating: 4.5, reviewCount: 100 }, { name: 'B', rating: 4.2, reviewCount: 60 }];

test('perfil completo e líder soma 100', () => {
  const s = calcScore(strong, rivals, NOW);
  assert.strictEqual(s.total, 100);
  assert.strictEqual(s.facts.posicao, 1);
  assert.deepStrictEqual(buildPlan(strong, s), []);
});

test('perfil vazio soma 0 e fica em último', () => {
  const s = calcScore({ name: 'Vazio' }, rivals, NOW);
  assert.strictEqual(s.total, 0);
  assert.strictEqual(s.facts.posicao, 3);
  assert.strictEqual(s.level.key, 'critico');
});

test('nota sem avaliações não pontua', () => {
  const s = calcScore({ rating: 5, reviewCount: 0 }, rivals, NOW);
  assert.strictEqual(s.criteria.find(c => c.key === 'nota').earned, 0);
});

test('plano ordena pelos pontos perdidos e os pontos fecham com a nota', () => {
  const b = { ...strong, rating: 3.9, website: '', photoCount: 2 };
  const s = calcScore(b, rivals, NOW);
  const plan = buildPlan(b, s);
  assert.ok(plan.length >= 3);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i - 1].points >= plan[i].points);
  assert.strictEqual(s.total + plan.reduce((t, p) => t + p.points, 0), 100);
});

test('demonstração é determinística e marcada como demo', () => {
  const a = fetchDemo('Padaria Central', NOW);
  const b = fetchDemo('padaria central ', NOW);
  assert.strictEqual(a.demo, true);
  assert.deepStrictEqual(a.competitors, b.competitors);
  assert.strictEqual(a.business.rating, b.business.rating);
});

test('versão gratuita não vaza o passo a passo', async () => {
  delete process.env.GOOGLE_PLACES_KEY;
  const r = await getReport('Clínica Sorriso Campinas');
  const pub = publicView(r);
  assert.ok(pub.problems.length <= 3);
  assert.ok(!JSON.stringify(pub).includes('"steps"'));
  assert.strictEqual(pub.ranking.filter(p => p.self).length, 1);
  assert.strictEqual(await getReport('ab'), null);
});
