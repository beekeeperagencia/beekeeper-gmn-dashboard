// Busca os dados da empresa e dos concorrentes. Com GOOGLE_PLACES_KEY usa a
// Places API (New); sem a chave devolve dados de exemplo determinísticos.

const BASE = 'https://places.googleapis.com/v1';
const BUSINESS_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount',
  'primaryType', 'primaryTypeDisplayName', 'types', 'photos', 'regularOpeningHours',
  'websiteUri', 'nationalPhoneNumber', 'reviews', 'googleMapsUri',
].map(f => `places.${f}`).join(',');
const COMPETITOR_FIELDS = ['id', 'displayName', 'rating', 'userRatingCount'].map(f => `places.${f}`).join(',');

async function gPost(path, body, fieldMask, key) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fieldMask },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`Places API ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function normalize(p) {
  const dates = (p.reviews || []).map(r => r.publishTime).filter(Boolean).sort();
  return {
    id: p.id,
    name: p.displayName?.text || '',
    address: p.formattedAddress || '',
    category: p.primaryTypeDisplayName?.text || '',
    primaryType: p.primaryType || '',
    types: p.types || [],
    rating: p.rating || 0,
    reviewCount: p.userRatingCount || 0,
    // A API devolve no máximo 10 fotos e 5 avaliações por lugar.
    photoCount: (p.photos || []).length,
    hasHours: !!p.regularOpeningHours,
    website: p.websiteUri || '',
    phone: p.nationalPhoneNumber || '',
    latestReviewAt: dates.length ? dates[dates.length - 1] : null,
    mapsUrl: p.googleMapsUri || '',
    location: p.location || null,
  };
}

async function fetchReal(query, key) {
  const found = await gPost('places:searchText', {
    textQuery: query, languageCode: 'pt-BR', regionCode: 'BR', maxResultCount: 1,
  }, BUSINESS_FIELDS, key);
  const place = found.places?.[0];
  if (!place) return null;
  const business = normalize(place);

  let competitors = [];
  if (business.location && business.primaryType) {
    const near = await gPost('places:searchNearby', {
      includedPrimaryTypes: [business.primaryType],
      maxResultCount: 10,
      rankPreference: 'POPULARITY',
      languageCode: 'pt-BR',
      locationRestriction: { circle: { center: business.location, radius: 3000 } },
    }, COMPETITOR_FIELDS, key);
    competitors = (near.places || [])
      .filter(p => p.id !== business.id)
      .map(p => ({ name: p.displayName?.text || '', rating: p.rating || 0, reviewCount: p.userRatingCount || 0 }));
  }
  return { business, competitors, demo: false };
}

// ---- Modo demonstração ----

function seeded(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function titleCase(s) {
  return s.replace(/\S+/g, w => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w));
}

function fetchDemo(query, now = Date.now()) {
  const rnd = seeded(query.toLowerCase().trim());
  const between = (a, b) => a + rnd() * (b - a);
  const business = {
    id: 'demo',
    name: titleCase(query.trim()),
    address: 'Endereço de exemplo, 123',
    category: 'Empresa local',
    primaryType: 'demo',
    types: rnd() > 0.5 ? ['demo', 'servico_a', 'servico_b'] : ['demo'],
    rating: Math.round(between(3.6, 4.9) * 10) / 10,
    reviewCount: Math.round(between(8, 160)),
    photoCount: Math.round(between(0, 10)),
    hasHours: rnd() > 0.25,
    website: rnd() > 0.4 ? 'https://exemplo.com.br' : '',
    phone: rnd() > 0.15 ? '(11) 0000-0000' : '',
    latestReviewAt: new Date(now - Math.round(between(3, 150)) * 86400000).toISOString(),
    mapsUrl: '',
    location: null,
  };
  const competitors = Array.from({ length: 6 }, (_, i) => ({
    name: `Concorrente de exemplo ${i + 1}`,
    rating: Math.round(between(3.9, 4.9) * 10) / 10,
    reviewCount: Math.round(between(30, 420)),
  }));
  return { business, competitors, demo: true };
}

async function fetchProfile(query, key = process.env.GOOGLE_PLACES_KEY) {
  return key ? fetchReal(query, key) : fetchDemo(query);
}

module.exports = { fetchProfile, fetchDemo, normalize };
