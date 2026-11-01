// Tipos compartilhados entre o coletor (Node) e o app (web).

export type ModelId =
  | 'galaxy-watch-ultra2'
  | 'galaxy-watch-ultra'
  | 'galaxy-watch9'
  | 'galaxy-watch8'
  | 'galaxy-watch8-classic'
  | 'galaxy-watch7'
  | 'galaxy-watch-fe'
  | 'galaxy-watch6'
  | 'galaxy-watch6-classic'
  | 'galaxy-watch5'
  | 'galaxy-watch5-pro'
  | 'galaxy-watch4'
  | 'galaxy-watch4-classic'
  | 'xiaomi-watch2'
  | 'xiaomi-watch2-pro'
  | 'ticwatch-pro5'
  | 'ticwatch-pro5-enduro'
  | 'ticwatch-atlas';

export type Connectivity = 'bt' | 'lte';
export type Condition = 'novo' | 'usado' | 'recondicionado';
export type SourceId = 'zoom' | 'samsung' | 'kabum' | 'amazon' | 'pelando' | 'promobit';

export interface CouponRef {
  code?: string;
  description?: string;
  /** Desconto fixo em reais, quando conhecido. */
  value?: number;
  /** Desconto percentual, quando conhecido. */
  percent?: number;
}

/** Oferta como sai de uma fonte, antes de classificar o modelo. */
export interface RawOffer {
  source: SourceId;
  /** Identificador estável dentro da fonte. */
  sourceOfferId: string;
  title: string;
  /** Nome canônico do produto no catálogo da fonte (Zoom), usado para identificar o modelo. */
  canonicalTitle?: string;
  store: string;
  seller?: string;
  /** Vendido por terceiro em marketplace. */
  marketplace?: boolean;
  /** Melhor preço à vista (Pix/boleto), já com o desconto que a loja aplica sozinha. */
  price: number;
  /** Preço no cartão, quando diferente do à vista. */
  priceCard?: number;
  /** Preço "de" anunciado pela loja. */
  listPrice?: number;
  installments?: { n: number; value: number };
  coupon?: CouponRef;
  /** Link para comprar. */
  url: string;
  /** Post na comunidade (Pelando/Promobit), quando existir. */
  discussionUrl?: string;
  image?: string;
  available: boolean;
  /** Condição informada pela própria fonte (prevalece sobre o título). */
  conditionHint?: Condition;
  /** Fim de oferta relâmpago, quando a loja informa. */
  endsAt?: string;
  /** Quando a oferta foi publicada na comunidade. */
  postedAt?: string;
  community?: { temperature?: number; likes?: number; comments?: number };
  freeShipping?: boolean;
}

/** Nacional = sem sinal de importação. Importado = loja internacional, versão global, envio do exterior etc. */
export type Origin = 'nacional' | 'importado';

export type ClassificationKind =
  | 'device'
  | 'accessory'
  | 'bundle'
  | 'clone'
  | 'ambiguous'
  | 'implausible'
  | 'other';

export interface Classification {
  kind: ClassificationKind;
  model?: ModelId;
  size?: number;
  connectivity?: Connectivity;
  condition: Condition;
  /** Explicação curta da decisão (transparência e depuração). */
  reason: string;
}

export type ScoreLabel = 'Imperdível' | 'Ótima' | 'Boa' | 'Na média' | 'Cara';

export interface Score {
  value: number;
  label: ScoreLabel;
  reasons: string[];
  /** Referências usadas no cálculo. */
  ref: { median30?: number; min90?: number; allTimeLow?: number; marketMedian?: number };
  /** Desconto anunciado pela loja parece inflado. */
  inflatedListPrice?: boolean;
}

/** Oferta classificada, pontuada e pronta para o app. */
export interface Offer extends RawOffer {
  id: string;
  model: ModelId;
  /** Ex.: "44mm-bt"; "padrao-bt" quando o modelo tem um tamanho só. */
  variant: string;
  /** Agrupa ofertas comparáveis: modelo|variante|condição. */
  variantKey: string;
  size?: number;
  connectivity: Connectivity;
  condition: Condition;
  origin: Origin;
  /** Por que a oferta foi considerada importada (ex.: "Versão global"). */
  originReason?: string;
  firstSeen: string;
  lastSeen: string;
  score: Score;
  /** Mesma oferta encontrada em outras fontes. */
  alsoOn?: { source: SourceId; url: string; discussionUrl?: string }[];
}

export interface Coupon {
  id: string;
  source: SourceId;
  store: string;
  code?: string;
  title: string;
  /** Texto curto do desconto, ex.: "10% OFF", "R$ 120 OFF". */
  discount?: string;
  validUntil?: string;
  publishedAt?: string;
  verified?: boolean;
  url?: string;
  /** Modelos citados no cupom (vazio = cupom geral da loja). */
  models: ModelId[];
  /** modelo = cita um dos relógios; smartwatch = vale para a categoria; loja = vale no site todo. */
  scope: 'modelo' | 'smartwatch' | 'loja';
}

export interface HistoryPoint {
  /** Dia (YYYY-MM-DD, fuso de São Paulo). */
  d: string;
  /** Menor preço do dia. */
  p: number;
  /** Loja do menor preço. */
  s: string;
  /** Origem do dado: coleta própria ou histórico importado. */
  o: 'coleta' | 'zoom' | 'pelando' | 'promobit';
}

export interface ModelHistory {
  model: ModelId;
  updatedAt: string;
  /** Série diária por variante (somente produto novo). */
  variants: Record<string, HistoryPoint[]>;
}

export interface VariantStats {
  variantKey: string;
  model: ModelId;
  variant: string;
  condition: Condition;
  current?: number;
  currentOfferId?: string;
  min90?: number;
  median30?: number;
  allTimeLow?: { price: number; date: string; store: string };
  /** Variação do menor preço em 7 dias (fração; -0.1 = caiu 10%). */
  trend7d?: number;
  days: number;
}

export interface ModelSummary {
  model: ModelId;
  bestOfferId?: string;
  bestPrice?: number;
  offersCount: number;
  variants: VariantStats[];
}

export interface Snapshot {
  generatedAt: string;
  offers: Offer[];
  summary: ModelSummary[];
}

export type SourceStatus = 'ok' | 'degradado' | 'falhou' | 'bloqueado' | 'aguardando';

export interface SourceHealth {
  source: SourceId;
  status: SourceStatus;
  lastRunAt?: string;
  lastOkAt?: string;
  durationMs?: number;
  /** Itens brutos retornados. */
  items: number;
  /** Ofertas reconhecidas como um dos modelos rastreados. */
  matched: number;
  error?: string;
  /** Observações informativas da última coleta. */
  notes?: string[];
  consecutiveFailures: number;
}

export interface Health {
  generatedAt: string;
  cycleMs: number;
  sources: SourceHealth[];
}

export type DealEventType = 'novo-minimo' | 'abaixo-alvo' | 'imperdivel' | 'queda-preco' | 'cupom-novo' | 'teste';

export interface DealEvent {
  id: string;
  at: string;
  type: DealEventType;
  model?: ModelId;
  offerId?: string;
  title: string;
  price?: number;
  store?: string;
  message: string;
  url?: string;
}

export interface AlertConfig {
  /** Preço-alvo por modelo (preço efetivo, produto novo). null = sem alvo. */
  alvos: Partial<Record<ModelId, number | null>>;
  alertarNovoMinimo: boolean;
  /** Índice de Oferta mínimo para alertar oferta "Imperdível". */
  indiceMinimo: number;
  incluirUsados: boolean;
  /** Também alertar ofertas importadas (AliExpress, versão global, envio do exterior). */
  incluirImportados: boolean;
  /** Também alertar os "demais modelos" (ocultos por padrão no app). */
  incluirVariantesOcultas: boolean;
  canais: { telegram: boolean; ntfy: boolean };
}
