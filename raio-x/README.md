# Raio-X do Google Meu Negócio

Página pública de captação: o visitante digita o nome da empresa e recebe a nota do perfil no Google (0 a 100), a comparação com concorrentes da região e os 3 maiores problemas. O plano de ação completo é liberado depois que ele deixa nome e WhatsApp.

É separado do painel interno (`../index.html`): o painel usa login Google e só vê perfis gerenciados pela Beekeeper; o Raio-X usa dados públicos e funciona para qualquer empresa.

## Rodar

```bash
cd raio-x
npm start        # http://localhost:3000
npm test
```

Não há dependências para instalar (Node 18+).

## Modo demonstração x dados reais

Sem `GOOGLE_PLACES_KEY` o Raio-X roda em **modo demonstração**: os números são gerados a partir do texto digitado e a página avisa que são de exemplo. Com a chave, ele consulta a Places API (New) do Google: uma busca pela empresa e uma busca de concorrentes próximos por análise.

A integração real ainda não foi testada com uma chave de verdade.

Copie `.env.example` para `.env` e preencha:

| Variável | Para quê |
|---|---|
| `GOOGLE_PLACES_KEY` | Liga os dados reais. Ative "Places API (New)" no Google Cloud e defina um teto de orçamento lá. |
| `LEAD_WEBHOOK_URL` | Recebe cada lead em JSON. Sem ela o lead fica só no log do servidor. |
| `WHATSAPP_NUMBER` | Mostra o botão de WhatsApp da agência no fim do plano. |

## Publicar

Na Vercel, importe o repositório com **Root Directory = `raio-x`** e cadastre as variáveis acima. Os arquivos de `api/` viram funções e o `index.html` é servido como página.

## Limites conhecidos

- O cache (3 dias) e o limite de 10 consultas por hora por visitante ficam em memória. Em serverless isso vale por instância, então o controle de gasto confiável é o teto de orçamento no Google Cloud.
- A API pública devolve no máximo 10 fotos e 5 avaliações por empresa; posts e produtos do perfil não são visíveis por ela.
- "Força frente aos concorrentes" é um índice próprio (nota ponderada pelo volume de avaliações), não a posição oficial no mapa do Google.

## Estrutura

- `lib/score.js`: cálculo da nota e textos do plano de ação
- `lib/places.js`: consulta ao Google e dados de demonstração
- `lib/report.js`: monta o relatório, cache, limite por visitante, versão gratuita
- `api/raio-x.js`, `api/lead.js`: endpoints
- `server.js`: servidor local
