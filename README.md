# WatchDeal BR ⌚📉

Rastreador **24 horas** de promoções e cupons para dez smartwatches (e seis variantes) no Brasil:

| Modelo | Variantes rastreadas | Ocultos por padrão |
|---|---|---|
| **Samsung Galaxy Watch Ultra** | 47 mm · LTE (inclui a edição 2025) | — |
| **Samsung Galaxy Watch8** | 40/44 mm · Bluetooth/LTE | Watch8 Classic (46 mm) |
| **Samsung Galaxy Watch7** | 40/44 mm · Bluetooth/LTE | — |
| **Samsung Galaxy Watch FE** | 40 mm · Bluetooth/LTE | — |
| **Samsung Galaxy Watch6** | 40/44 mm · Bluetooth/LTE | Watch6 Classic (43/47 mm) |
| **Samsung Galaxy Watch5** | 40/44 mm · Bluetooth/LTE | Watch5 Pro (45 mm) |
| **Samsung Galaxy Watch4** | 40/44 mm · Bluetooth/LTE | Watch4 Classic (42/46 mm) |
| **Xiaomi Watch 2** | Bluetooth | Xiaomi Watch 2 Pro |
| **Mobvoi TicWatch Pro 5** | Bluetooth | TicWatch Pro 5 Enduro |
| **Mobvoi TicWatch Atlas** | Bluetooth | — |

Os ocultos são identificados e ganham histórico, mas só aparecem no app com o filtro **Mostrar Classic, Pro e Enduro** e só geram alerta com `incluirVariantesOcultas` (veja o [guia](docs/GUIA.md#4-preço-alvo-e-preferências)).

Roda de graça no GitHub (Actions + Pages) e vira um **app instalável no celular** (PWA), com alertas por **Telegram** ou **ntfy**. O computador serve só para desenvolver.

## O que ele faz

- **Coleta a cada 5 min** (cada fonte no seu ritmo, de 5 a 30 min) em 6 fontes, cada uma no seu ritmo:
  - **Zoom**: comparador que cobre Magalu, Amazon, Casas Bahia, Fast Shop e outras, com ~40 dias de histórico por produto.
  - **Samsung**: loja oficial, com preço no Pix.
  - **KaBuM!**: inclui usados e Oferta Ninja.
  - **Amazon**
  - **Pelando**: ofertas da comunidade com "temperatura".
  - **Promobit**: ofertas com cupom, mural de cupons e histórico de ofertas encerradas.
- **Identifica o modelo de verdade**: separa Watch8 de Watch8 Classic, Watch5 de Watch5 Pro, TicWatch Pro 5 de Pro 5 Enduro e de clones "Watch 8 Ultra", e descarta pulseira, película, carregador, combos com celular e listas de compatibilidade. Usa o código do fabricante (SM-R860, SM-L320, SM-L705, M2320W1…) quando ele aparece. Tudo isso é coberto por mais de 90 casos de teste com títulos reais.
- **Histórico de preço** por variante: menor preço do dia entre todas as lojas, incluindo o histórico importado do Zoom e ofertas antigas das comunidades.
- **Índice de Oferta (0–100)**, de 50 (preço típico) a 85+ (*Imperdível*):
  - **Base:** distância da mediana de 30 dias.
  - **Bônus:** menor preço em 90 dias ou o menor já registrado.
  - **Desconto:** vendedor terceiro de marketplace.
  - **Detecta:** preço "de" inflado.
  - **Conservador:** sem histórico suficiente, o teto é *Boa*.
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
