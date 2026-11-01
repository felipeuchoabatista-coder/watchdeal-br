# WatchDeal BR ⌚📉

Rastreador **24 horas** de promoções e cupons para os smartwatches Wear OS vendidos no Brasil: 18 modelos, em dois grupos.

**Configurados** (aparecem no app e geram alerta):

| Modelo | Variantes |
|---|---|
| **Samsung Galaxy Watch Ultra** | 47 mm · LTE (inclui a edição 2025) |
| **Samsung Galaxy Watch8** | 40/44 mm · Bluetooth/LTE |
| **Samsung Galaxy Watch7** | 40/44 mm · Bluetooth/LTE |
| **Samsung Galaxy Watch FE** | 40 mm · Bluetooth/LTE |
| **Samsung Galaxy Watch4** | 40/44 mm · Bluetooth/LTE |
| **Xiaomi Watch 2** | Bluetooth |
| **Xiaomi Watch 2 Pro** | Bluetooth/LTE |
| **Mobvoi TicWatch Pro 5** | Bluetooth |

**Demais modelos** (rastreados e com histórico; aparecem com o filtro **Mostrar demais modelos** e alertam com `incluirVariantesOcultas`):
Galaxy Watch Ultra 2 (47 mm LTE), Galaxy Watch9 (40/44 mm), Watch8 Classic (46 mm), Watch6 (40/44 mm), Watch6 Classic (43/47 mm), Watch5 (40/44 mm), Watch5 Pro (45 mm), Watch4 Classic (42/46 mm), TicWatch Pro 5 Enduro e TicWatch Atlas.

Para mudar quem é "configurado", basta trocar `primary` em [`src/core/catalog.ts`](src/core/catalog.ts).

Roda de graça no GitHub (Actions + Pages) e vira um **app instalável no celular** (PWA), com alertas por **Telegram** ou **ntfy**. O computador serve só para desenvolver.

## O que ele faz

- **Coleta a cada 5 min** (cada fonte no seu ritmo, de 5 a 30 min) em 6 fontes, cada uma no seu ritmo:
  - **Zoom**: comparador que cobre Magalu, Amazon, Casas Bahia, Fast Shop e outras, com ~40 dias de histórico por produto.
  - **Samsung**: loja oficial, com preço no Pix.
  - **KaBuM!**: inclui usados e Oferta Ninja.
  - **Amazon**
  - **Pelando**: ofertas da comunidade com "temperatura".
  - **Promobit**: ofertas com cupom, mural de cupons e histórico de ofertas encerradas.
- **Identifica o modelo de verdade**: separa Watch8 de Watch8 Classic, Ultra de Ultra 2, TicWatch Pro 5 de Pro 5 Enduro e de clones "Watch 8 Ultra", e descarta pulseira, película, carregador, combos com celular e listas de compatibilidade. Usa o código do fabricante (SM-R860, SM-L320, SM-L705, M2320W1…) quando ele aparece. Tudo isso é coberto por mais de 100 casos de teste com títulos reais.
- **Piso de segurança**: cada modelo tem um preço mínimo plausível. Um "Galaxy Watch Ultra" por R$ 299 é marcado como suspeito, não como oferta.
- **Nacional ou importado**: cada oferta é marcada pela loja (AliExpress…), pelo código Samsung de outro país (sufixo XAA = EUA; ZTO = Brasil), pelo vendedor importador ou por "versão global", "envio do exterior" e "taxas inclusas" no título. O app mostra o motivo, tem o filtro **Só ofertas nacionais** e o Índice desconta 5 pontos de importados.
- **Histórico de preço** por variante: menor preço do dia entre todas as lojas, incluindo o histórico importado do Zoom e ofertas antigas das comunidades.
- **Índice de Oferta (0–100)**, de 50 (preço típico) a 85+ (*Imperdível*):
  - **Base:** distância da mediana de 30 dias.
  - **Bônus:** menor preço em 90 dias ou o menor já registrado.
  - **Desconto:** vendedor terceiro de marketplace ou produto importado.
  - **Detecta:** preço "de" inflado.
  - **Conservador:** sem histórico suficiente, o teto é *Boa*.
- **Onde comprar**: na página de cada modelo, a oferta mais barata de cada loja (da mais barata para a mais cara) e atalhos de busca no Mercado Livre, Amazon, Google Shopping, Magalu, Casas Bahia, KaBuM! e Shopee. Os três primeiros já abrem do menor preço, a partir do piso do modelo, para pulseiras e películas não aparecerem no topo.
- **Cupons relevantes**: códigos das ofertas e cupons por loja. Cupons de outras categorias (moda, games, móveis…) são descartados.
- **Alertas sem repetição**:
  - menor preço em 90 dias
  - abaixo do seu preço-alvo
  - oferta imperdível
  - queda de 5% ou mais
  - cupom novo para os relógios
- **Ética de coleta**: requisições espaçadas e identificadas. Se um site bloqueia (Mercado Livre e Magalu bloqueiam acesso direto), a fonte é marcada como bloqueada e **não há tentativa de burlar**. Os preços dessas lojas chegam via Zoom e comunidades.

## Como funciona

```
GitHub Actions (a cada 5 min; cada execução agenda a próxima)
  └─ src/run.ts ── fontes (src/sources/*) ──► classifica (core/matcher)
        │                                     pontua (core/scoring)
        │                                     histórico (core/history)
        ├─► branch "data": ofertas.json, cupons.json, historico/*.json, eventos.json, saude.json
        ├─► alertas: Telegram / ntfy (src/alerts)
        └─► GitHub Pages: app PWA (web/) + dados
```

| Pasta | Conteúdo |
|---|---|
| `src/core` | Catálogo de modelos, identificação, pontuação, histórico, cupons e HTTP. Sem dependências. |
| `src/sources` | Um conector por fonte, cada um com parser puro testado contra amostras reais (`test/fixtures`). |
| `src/pipeline.ts` | Junta tudo: deduplica a mesma oferta vista em várias fontes, calcula referências, gera eventos. |
| `web/` | App React instalável: funciona offline, tem tema claro/escuro e gráfico com toque. |
| `config/alertas.json` | Preço-alvo por modelo e preferências dos alertas (editável pelo site do GitHub). |

## Rodar no computador (desenvolvimento)

Requer Node 24+.

```bash
npm install
npm run coletar:tudo -- --sem-alertas   # coleta real em todas as fontes → pasta data/
npm run dev                              # app em http://localhost:5173
npm test                                 # testes (identificação, fontes, ciclo completo)
npm run typecheck
```

## Publicar e instalar no celular

Passo a passo em **[docs/GUIA.md](docs/GUIA.md)**.
