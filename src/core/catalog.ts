import type { Connectivity, ModelId } from './types.ts';

export interface ModelCode {
  /** Prefixo do código de modelo do fabricante (ex.: "SM-R860"). */
  code: string;
  size?: number;
  connectivity: Connectivity;
}

export interface ModelSpec {
  id: ModelId;
  name: string;
  shortName: string;
  brand: 'Samsung' | 'Xiaomi' | 'Mobvoi';
  /** Termo de busca nas lojas (atalhos "buscar em outras lojas"). */
  query: string;
  /** Modelo configurado (principal); os demais ficam ocultos no app e não alertam por padrão. */
  primary: boolean;
  /** Linha do produto (Classic -> base), usada para agrupar filtros e "Veja também". */
  family: ModelId;
  sizes: number[];
  /** Conectividades vendidas. Com uma só (ex.: Watch Ultra só LTE), ela vale mesmo sem aparecer no título. */
  connectivities: Connectivity[];
  codes: ModelCode[];
  /**
   * Faixa de preço plausível para produto NOVO, em reais.
   * Abaixo do mínimo quase sempre é acessório, clone ou golpe.
   */
  plausible: { min: number; max: number };
  launchYear: number;
  /** Cor de destaque no app. */
  color: string;
}

const BT_LTE: Connectivity[] = ['bt', 'lte'];

export const MODELS: ModelSpec[] = [
  // --- Principais (configurados): aparecem no app e geram alerta ---
  {
    id: 'galaxy-watch-ultra',
    name: 'Samsung Galaxy Watch Ultra',
    shortName: 'Galaxy Watch Ultra',
    query: 'Galaxy Watch Ultra',
    brand: 'Samsung',
    primary: true,
    family: 'galaxy-watch-ultra',
    sizes: [47],
    connectivities: ['lte'],
    // A edição 2025 (64 GB, Titânio Azul) usa o mesmo código e entra aqui.
    codes: [{ code: 'SM-L705', size: 47, connectivity: 'lte' }],
    plausible: { min: 900, max: 7000 },
    launchYear: 2024,
    color: '#64748b',
  },
  {
    id: 'galaxy-watch8',
    name: 'Samsung Galaxy Watch8',
    shortName: 'Galaxy Watch8',
    query: 'Galaxy Watch8',
    brand: 'Samsung',
    primary: true,
    family: 'galaxy-watch8',
    sizes: [40, 44],
    connectivities: BT_LTE,
    codes: [
      { code: 'SM-L320', size: 40, connectivity: 'bt' },
      { code: 'SM-L325', size: 40, connectivity: 'lte' },
      { code: 'SM-L330', size: 44, connectivity: 'bt' },
      { code: 'SM-L335', size: 44, connectivity: 'lte' },
    ],
    plausible: { min: 650, max: 4500 },
    launchYear: 2025,
    color: '#2f6fed',
  },
  {
    id: 'galaxy-watch7',
    name: 'Samsung Galaxy Watch7',
    shortName: 'Galaxy Watch7',
    query: 'Galaxy Watch7',
    brand: 'Samsung',
    primary: true,
    family: 'galaxy-watch7',
    sizes: [40, 44],
    connectivities: BT_LTE,
    codes: [
      { code: 'SM-L300', size: 40, connectivity: 'bt' },
      { code: 'SM-L305', size: 40, connectivity: 'lte' },
      { code: 'SM-L310', size: 44, connectivity: 'bt' },
      { code: 'SM-L315', size: 44, connectivity: 'lte' },
    ],
    plausible: { min: 550, max: 4500 },
    launchYear: 2024,
    color: '#0891b2',
  },
  {
    id: 'galaxy-watch-fe',
    name: 'Samsung Galaxy Watch FE',
    shortName: 'Galaxy Watch FE',
    query: 'Galaxy Watch FE',
    brand: 'Samsung',
    primary: true,
    family: 'galaxy-watch-fe',
    sizes: [40],
    connectivities: BT_LTE,
    codes: [
      { code: 'SM-R861', size: 40, connectivity: 'bt' },
      { code: 'SM-R866', size: 40, connectivity: 'lte' },
    ],
    plausible: { min: 400, max: 2500 },
    launchYear: 2024,
    color: '#0e9f6e',
  },
  {
    id: 'galaxy-watch4',
    name: 'Samsung Galaxy Watch4',
    shortName: 'Galaxy Watch4',
    query: 'Galaxy Watch4',
    brand: 'Samsung',
    primary: true,
    family: 'galaxy-watch4',
    sizes: [40, 44],
    connectivities: BT_LTE,
    codes: [
      { code: 'SM-R860', size: 40, connectivity: 'bt' },
      { code: 'SM-R865', size: 40, connectivity: 'lte' },
      { code: 'SM-R870', size: 44, connectivity: 'bt' },
      { code: 'SM-R875', size: 44, connectivity: 'lte' },
    ],
    plausible: { min: 350, max: 2500 },
    launchYear: 2021,
    color: '#7c3aed',
  },
  {
    id: 'xiaomi-watch2',
    name: 'Xiaomi Watch 2',
    shortName: 'Xiaomi Watch 2',
    query: 'Xiaomi Watch 2',
    brand: 'Xiaomi',
    primary: true,
    family: 'xiaomi-watch2',
    sizes: [],
    connectivities: ['bt'],
    codes: [{ code: 'M2320W1', connectivity: 'bt' }],
    plausible: { min: 380, max: 2500 },
    launchYear: 2024,
    color: '#f97316',
  },
  {
    id: 'xiaomi-watch2-pro',
    name: 'Xiaomi Watch 2 Pro',
    shortName: 'Watch 2 Pro',
    query: 'Xiaomi Watch 2 Pro',
    brand: 'Xiaomi',
    primary: true,
    family: 'xiaomi-watch2',
    sizes: [],
    connectivities: BT_LTE,
    codes: [
      { code: 'M2234W1', connectivity: 'bt' },
      { code: 'M2233W1', connectivity: 'lte' },
    ],
    plausible: { min: 600, max: 3500 },
    launchYear: 2023,
    color: '#c2410c',
  },
  {
    id: 'ticwatch-pro5',
    name: 'Mobvoi TicWatch Pro 5',
    shortName: 'TicWatch Pro 5',
    query: 'TicWatch Pro 5',
    brand: 'Mobvoi',
    primary: true,
    family: 'ticwatch-pro5',
    sizes: [],
    connectivities: ['bt'],
    // Sem código: o Pro 5 e o Pro 5 Enduro compartilham o mesmo, e só o nome os separa.
    codes: [],
    plausible: { min: 700, max: 4500 },
    launchYear: 2023,
    color: '#dc2626',
  },
  // --- Demais modelos Wear OS vendidos no Brasil: rastreados, ocultos por padrão ---
  {
    id: 'galaxy-watch-ultra2',
    name: 'Samsung Galaxy Watch Ultra 2',
    shortName: 'Galaxy Watch Ultra 2',
    query: 'Galaxy Watch Ultra 2',
    brand: 'Samsung',
    primary: false,
    family: 'galaxy-watch-ultra2',
    sizes: [47],
    connectivities: ['lte'],
    codes: [{ code: 'SM-L715', size: 47, connectivity: 'lte' }],
    plausible: { min: 1500, max: 8000 },
    launchYear: 2026,
    color: '#334155',
  },
  {
    id: 'galaxy-watch9',
    name: 'Samsung Galaxy Watch9',
    shortName: 'Galaxy Watch9',
    query: 'Galaxy Watch9',
    brand: 'Samsung',
    primary: false,
    family: 'galaxy-watch9',
    sizes: [40, 44],
    connectivities: BT_LTE,
    codes: [
      { code: 'SM-L340', size: 40, connectivity: 'bt' },
      { code: 'SM-L345', size: 40, connectivity: 'lte' },
      { code: 'SM-L350', size: 44, connectivity: 'bt' },
      { code: 'SM-L355', size: 44, connectivity: 'lte' },
    ],
    plausible: { min: 1000, max: 6000 },
    launchYear: 2026,
    color: '#4338ca',
  },
  {
    id: 'galaxy-watch8-classic',
    name: 'Samsung Galaxy Watch8 Classic',
    shortName: 'Watch8 Classic',
    query: 'Galaxy Watch8 Classic',
    brand: 'Samsung',
    primary: false,
    family: 'galaxy-watch8',
    sizes: [46],
    connectivities: BT_LTE,
    codes: [
      { code: 'SM-L500', size: 46, connectivity: 'bt' },
      { code: 'SM-L505', size: 46, connectivity: 'lte' },
    ],
    plausible: { min: 900, max: 6000 },
    launchYear: 2025,
    color: '#1e40af',
  },
  {
    id: 'galaxy-watch6',
    name: 'Samsung Galaxy Watch6',
    shortName: 'Galaxy Watch6',
    query: 'Galaxy Watch6',
    brand: 'Samsung',
    primary: false,
    family: 'galaxy-watch6',
    sizes: [40, 44],
    connectivities: BT_LTE,
    codes: [
      { code: 'SM-R930', size: 40, connectivity: 'bt' },
      { code: 'SM-R935', size: 40, connectivity: 'lte' },
      { code: 'SM-R940', size: 44, connectivity: 'bt' },
      { code: 'SM-R945', size: 44, connectivity: 'lte' },
    ],
    plausible: { min: 500, max: 4000 },
    launchYear: 2023,
    color: '#db2777',
  },
  {
    id: 'galaxy-watch6-classic',
    name: 'Samsung Galaxy Watch6 Classic',
    shortName: 'Watch6 Classic',
    query: 'Galaxy Watch6 Classic',
    brand: 'Samsung',
    primary: false,
    family: 'galaxy-watch6',
    sizes: [43, 47],
    connectivities: BT_LTE,
    codes: [
      { code: 'SM-R950', size: 43, connectivity: 'bt' },
      { code: 'SM-R955', size: 43, connectivity: 'lte' },
      { code: 'SM-R960', size: 47, connectivity: 'bt' },
      { code: 'SM-R965', size: 47, connectivity: 'lte' },
    ],
    plausible: { min: 600, max: 5000 },
    launchYear: 2023,
    color: '#9d174d',
  },
  {
    id: 'galaxy-watch5',
    name: 'Samsung Galaxy Watch5',
    shortName: 'Galaxy Watch5',
    query: 'Galaxy Watch5',
    brand: 'Samsung',
    primary: false,
    family: 'galaxy-watch5',
    sizes: [40, 44],
    connectivities: BT_LTE,
    codes: [
      { code: 'SM-R900', size: 40, connectivity: 'bt' },
      { code: 'SM-R905', size: 40, connectivity: 'lte' },
      { code: 'SM-R910', size: 44, connectivity: 'bt' },
      { code: 'SM-R915', size: 44, connectivity: 'lte' },
    ],
    plausible: { min: 450, max: 3500 },
    launchYear: 2022,
    color: '#a16207',
  },
  {
    id: 'galaxy-watch5-pro',
    name: 'Samsung Galaxy Watch5 Pro',
    shortName: 'Watch5 Pro',
    query: 'Galaxy Watch5 Pro',
    brand: 'Samsung',
    primary: false,
    family: 'galaxy-watch5',
    sizes: [45],
    connectivities: BT_LTE,
    codes: [
      { code: 'SM-R920', size: 45, connectivity: 'bt' },
      { code: 'SM-R925', size: 45, connectivity: 'lte' },
    ],
    plausible: { min: 650, max: 5000 },
    launchYear: 2022,
    color: '#854d0e',
  },
  {
    id: 'galaxy-watch4-classic',
    name: 'Samsung Galaxy Watch4 Classic',
    shortName: 'Watch4 Classic',
    query: 'Galaxy Watch4 Classic',
    brand: 'Samsung',
    primary: false,
    family: 'galaxy-watch4',
    sizes: [42, 46],
    connectivities: BT_LTE,
    codes: [
      { code: 'SM-R880', size: 42, connectivity: 'bt' },
      { code: 'SM-R885', size: 42, connectivity: 'lte' },
      { code: 'SM-R890', size: 46, connectivity: 'bt' },
      { code: 'SM-R895', size: 46, connectivity: 'lte' },
    ],
    plausible: { min: 400, max: 5000 },
    launchYear: 2021,
    color: '#5b21b6',
  },
  {
    id: 'ticwatch-pro5-enduro',
    name: 'Mobvoi TicWatch Pro 5 Enduro',
    shortName: 'TicWatch Pro 5 Enduro',
    query: 'TicWatch Pro 5 Enduro',
    brand: 'Mobvoi',
    primary: false,
    family: 'ticwatch-pro5',
    sizes: [],
    connectivities: ['bt'],
    codes: [],
    plausible: { min: 700, max: 4500 },
    launchYear: 2024,
    color: '#991b1b',
  },
  {
    id: 'ticwatch-atlas',
    name: 'Mobvoi TicWatch Atlas',
    shortName: 'TicWatch Atlas',
    query: 'TicWatch Atlas',
    brand: 'Mobvoi',
    primary: false,
    family: 'ticwatch-atlas',
    sizes: [],
    connectivities: ['bt'],
    codes: [],
    plausible: { min: 700, max: 4500 },
    launchYear: 2024,
    color: '#65a30d',
  },
];

const BY_ID = new Map(MODELS.map((m) => [m.id, m]));

export function getModel(id: ModelId): ModelSpec {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`Modelo desconhecido: ${id}`);
  return spec;
}

export const PRIMARY_MODELS = MODELS.filter((m) => m.primary);

/** Linhas de produto (Watch8 + Watch8 Classic…) dos modelos informados, na ordem do catálogo. */
export function familiesOf(models: ModelSpec[]): ModelId[] {
  return [...new Set(models.map((m) => m.family))];
}

export function variantOf(model: ModelId, size: number | undefined, connectivity: Connectivity): string {
  const spec = getModel(model);
  const sizePart = spec.sizes.length === 0 ? 'padrao' : size ? `${size}mm` : 'tamx';
  return `${sizePart}-${connectivity}`;
}

export function variantLabel(variant: string): string {
  const [size, conn] = variant.split('-');
  const sizeLabel = size === 'padrao' ? '' : size === 'tamx' ? 'Tamanho n/i' : size;
  const connLabel = conn === 'lte' ? 'LTE' : 'Bluetooth';
  return [sizeLabel, connLabel].filter(Boolean).join(' · ');
}

export function variantKeyOf(model: ModelId, variant: string, condition: string): string {
  return `${model}|${variant}|${condition}`;
}
