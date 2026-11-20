/**
 * Caixa de entrada de leads do Raio-X numa planilha do Google.
 *
 * Como instalar (uma vez só):
 * 1. Crie uma planilha nova no Google Planilhas.
 * 2. Menu Extensões > Apps Script. Apague o que estiver lá e cole este arquivo.
 * 3. Troque o valor de TOKEN abaixo por uma senha sua (letras e números).
 * 4. Implantar > Nova implantação > tipo "App da Web".
 *    Executar como: "Eu". Quem pode acessar: "Qualquer pessoa".
 * 5. Copie o endereço gerado e acrescente no fim: ?token=SUA_SENHA
 *    Esse endereço completo é usado em dois lugares:
 *    - variável LEAD_WEBHOOK_URL do Raio-X;
 *    - botão "⬇ Raio-X" do CRM de prospecção (ele pede na primeira vez).
 */
const TOKEN = 'TROQUE-ESTA-SENHA';
const COLUNAS = ['Data', 'Nome', 'WhatsApp', 'Empresa', 'Endereço', 'Nota', 'Demonstração'];

function aba() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (s.getLastRow() === 0) s.appendRow(COLUNAS);
  return s;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Texto vindo de formulário público nunca pode virar fórmula na planilha.
function texto(v) {
  return "'" + String(v == null ? '' : v).slice(0, 200);
}

function doPost(e) {
  if (e.parameter.token !== TOKEN) return json({ error: 'token inválido' });
  const d = JSON.parse(e.postData.contents);
  aba().appendRow([texto(d.at), texto(d.name), texto(d.whatsapp), texto(d.business), texto(d.address), Number(d.score) || 0, d.demo ? 'sim' : '']);
  return json({ ok: true });
}

function doGet(e) {
  if (e.parameter.token !== TOKEN) return json({ error: 'token inválido' });
  const linhas = aba().getDataRange().getValues().slice(1);
  return json({
    leads: linhas.map(function (r) {
      return { at: String(r[0]), name: String(r[1]), whatsapp: String(r[2]), business: String(r[3]), address: String(r[4]), score: r[5], demo: r[6] === 'sim' };
    }),
  });
}
