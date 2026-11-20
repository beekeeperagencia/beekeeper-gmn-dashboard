// Cálculo da nota do Raio-X (0 a 100) a partir de dados PÚBLICOS do perfil.
// Diferente do painel interno (que usa a API de gestão), aqui só entra o que
// qualquer pessoa vê no Google: nota, avaliações, fotos, horário, site, telefone.

const DAY = 24 * 60 * 60 * 1000;
const GENERIC_TYPES = new Set(['point_of_interest', 'establishment', 'store', 'food', 'health']);

const CRITERIA = [
  { key: 'nota', label: 'Nota média', max: 20 },
  { key: 'volume', label: 'Quantidade de avaliações', max: 20 },
  { key: 'recencia', label: 'Avaliações recentes', max: 10 },
  { key: 'forca', label: 'Força frente aos concorrentes', max: 10 },
  { key: 'fotos', label: 'Fotos', max: 10 },
  { key: 'horario', label: 'Horário de funcionamento', max: 10 },
  { key: 'site', label: 'Site', max: 10 },
  { key: 'telefone', label: 'Telefone', max: 5 },
  { key: 'categorias', label: 'Categorias', max: 5 },
];

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Índice simples de reputação: nota ponderada pelo volume. Não é o ranking do Google.
function strength(p) {
  return (p.rating || 0) * Math.log10((p.reviewCount || 0) + 1);
}

function calcScore(business, competitors = [], now = Date.now()) {
  const b = business;
  const earned = {};
  const facts = {};

  const rating = b.reviewCount > 0 ? b.rating || 0 : 0;
  earned.nota = rating >= 4.8 ? 20 : rating >= 4.5 ? 16 : rating >= 4.2 ? 12 : rating >= 4.0 ? 8 : rating >= 3.5 ? 4 : 0;

  const count = b.reviewCount || 0;
  const med = median(competitors.map(c => c.reviewCount || 0));
  facts.medianaConcorrentes = Math.round(med);
  if (med > 0) {
    const r = count / med;
    earned.volume = r >= 1.5 ? 20 : r >= 1 ? 16 : r >= 0.6 ? 10 : r >= 0.3 ? 5 : count > 0 ? 2 : 0;
  } else {
    earned.volume = count >= 200 ? 20 : count >= 100 ? 16 : count >= 50 ? 10 : count >= 20 ? 5 : count > 0 ? 2 : 0;
  }

  const last = b.latestReviewAt ? new Date(b.latestReviewAt).getTime() : null;
  const days = last ? Math.max(0, Math.floor((now - last) / DAY)) : null;
  facts.diasDesdeUltimaAvaliacao = days;
  earned.recencia = days === null ? 0 : days <= 14 ? 10 : days <= 30 ? 7 : days <= 90 ? 4 : 0;

  const ranked = [{ ...b, self: true }, ...competitors].sort((x, y) => strength(y) - strength(x));
  const pos = ranked.findIndex(p => p.self) + 1;
  facts.posicao = pos;
  facts.totalComparados = ranked.length;
  // Em listas pequenas "top 3" seria todo mundo, então o pódio só vale na metade de cima.
  const half = Math.ceil(ranked.length / 2);
  earned.forca = !competitors.length ? 5 : pos === 1 ? 10 : pos <= Math.min(3, half) ? 7 : pos <= half ? 4 : 0;

  const photos = b.photoCount || 0;
  earned.fotos = photos >= 10 ? 10 : photos >= 5 ? 6 : photos >= 1 ? 3 : 0;

  earned.horario = b.hasHours ? 10 : 0;
  earned.site = b.website ? 10 : 0;
  earned.telefone = b.phone ? 5 : 0;

  const extra = (b.types || []).filter(t => t !== b.primaryType && !GENERIC_TYPES.has(t)).length;
  earned.categorias = extra >= 2 ? 5 : extra === 1 ? 3 : 0;

  const total = CRITERIA.reduce((sum, c) => sum + earned[c.key], 0);
  const criteria = CRITERIA.map(c => ({ ...c, earned: earned[c.key], lost: c.max - earned[c.key] }));
  return { total, criteria, facts, level: level(total) };
}

function level(total) {
  if (total >= 85) return { key: 'otimo', label: 'Perfil forte' };
  if (total >= 65) return { key: 'bom', label: 'Bom, com espaço para crescer' };
  if (total >= 40) return { key: 'atencao', label: 'Perdendo clientes para concorrentes' };
  return { key: 'critico', label: 'Quase invisível no Google' };
}

// Texto de cada problema: "why" aparece de graça, "steps" só no plano completo.
function advice(key, b, facts) {
  const med = facts.medianaConcorrentes;
  const A = {
    nota: {
      title: b.reviewCount ? `Nota ${fmt(b.rating)} abaixo do ideal` : 'Perfil ainda sem nota',
      why: 'A maioria das pessoas filtra por 4,5 estrelas ou mais antes de ligar ou pedir rota.',
      steps: [
        'Responder todas as avaliações negativas em até 48h, com solução e contato direto.',
        'Pedir avaliação logo após cada atendimento bem-sucedido, com link direto ou QR code no balcão.',
        'Corrigir a causa das reclamações que se repetem nas avaliações de 1 a 3 estrelas.',
      ],
    },
    volume: {
      title: med ? `${b.reviewCount || 0} avaliações contra ${med} dos concorrentes` : 'Poucas avaliações',
      why: 'Quantidade de avaliações é um dos sinais que mais pesam para aparecer no mapa.',
      steps: [
        'Criar o link curto de avaliação do perfil e enviar por WhatsApp a cada cliente atendido.',
        'Definir meta semanal de novas avaliações para a equipe (comece com 5 por semana).',
        'Reativar a base antiga: mensagem para clientes dos últimos 6 meses pedindo a avaliação.',
      ],
    },
    recencia: {
      title: facts.diasDesdeUltimaAvaliacao === null ? 'Nenhuma avaliação recente encontrada' : `Última avaliação há ${facts.diasDesdeUltimaAvaliacao} dias`,
      why: 'Perfil sem avaliação nova parece abandonado, para o Google e para quem está escolhendo.',
      steps: [
        'Transformar o pedido de avaliação em rotina fixa do atendimento, não em campanha pontual.',
        'Responder cada avaliação nova: a resposta também conta como atividade no perfil.',
      ],
    },
    forca: {
      title: `${facts.posicao}º lugar entre ${facts.totalComparados} empresas da região`,
      why: 'Quem está nas 3 primeiras posições do mapa fica com a maior parte das ligações e rotas.',
      steps: [
        'Atacar primeiro nota e volume de avaliações: são os dois fatores que mais mudam a posição.',
        'Publicar fotos e novidades toda semana para manter o perfil ativo.',
        'Acompanhar mensalmente a posição frente aos mesmos concorrentes.',
      ],
    },
    fotos: {
      title: b.photoCount ? `Só ${b.photoCount} foto${b.photoCount > 1 ? 's' : ''} no perfil` : 'Perfil sem fotos',
      why: 'Perfis com muitas fotos recebem bem mais pedidos de rota e cliques para o site.',
      steps: [
        'Subir pelo menos 10 fotos: fachada, interior, equipe, produtos ou serviços em andamento.',
        'Adicionar 2 fotos novas por semana para manter a atividade do perfil.',
        'Definir logo e foto de capa profissionais.',
      ],
    },
    horario: {
      title: 'Horário de funcionamento não informado',
      why: 'Sem horário, o Google não mostra "Aberto agora" e o cliente escolhe quem mostra.',
      steps: ['Cadastrar o horário de todos os dias da semana.', 'Cadastrar horários especiais de feriados.'],
    },
    site: {
      title: 'Perfil sem site',
      why: 'O site reforça para o Google quais serviços e bairros a empresa atende.',
      steps: [
        'Vincular um site ou landing page com nome, endereço e telefone iguais aos do perfil.',
        'Colocar no site os serviços e a região atendida com as palavras que o cliente busca.',
      ],
    },
    telefone: {
      title: 'Perfil sem telefone',
      why: 'Sem telefone não existe o botão "Ligar", que é a ação mais direta para virar cliente.',
      steps: ['Cadastrar um telefone que seja atendido em horário comercial, de preferência com WhatsApp.'],
    },
    categorias: {
      title: 'Poucas categorias cadastradas',
      why: 'Cada categoria é uma busca a mais em que o perfil pode aparecer.',
      steps: [
        'Revisar a categoria principal: ela deve ser a mais específica possível.',
        'Adicionar categorias secundárias para cada serviço relevante que a empresa presta.',
      ],
    },
  };
  return A[key];
}

function fmt(n) {
  return (n || 0).toFixed(1).replace('.', ',');
}

function buildPlan(business, score) {
  return score.criteria
    .filter(c => c.lost > 0)
    .sort((a, b) => b.lost - a.lost)
    .map(c => ({ key: c.key, label: c.label, points: c.lost, ...advice(c.key, business, score.facts) }));
}

module.exports = { calcScore, buildPlan, strength, CRITERIA };
