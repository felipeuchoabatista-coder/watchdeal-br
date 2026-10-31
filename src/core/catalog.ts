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
  brand: 'Samsung' | 'Xiaomi';
  /** Modelo pedido pelo usuário; os demais (Classic/Pro) ficam ocultos por padrão. */
  primary: boolean;
  /** Modelo principal ao qual esta variante pertence (Classic -> base). */
  family: ModelId;
  sizes: number[];
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

export const MODELS: ModelSpec[] = [
  {
    id: 'galaxy-watch8',
    name: 'Samsung Galaxy Watch8',
    shortName: 'Galaxy Watch8',
    brand: 'Samsung',
    primary: true,
    family: 'galaxy-watch8',
    sizes: [40, 44],
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
    id: 'galaxy-watch-fe',
    name: 'Samsung Galaxy Watch FE',
    shortName: 'Galaxy Watch FE',
    brand: 'Samsung',
    primary: true,
    family: 'galaxy-watch-fe',
    sizes: [40],
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
    brand: 'Samsung',
    primary: true,
    family: 'galaxy-watch4',
    sizes: [40, 44],
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
    brand: 'Xiaomi',
    primary: true,
    family: 'xiaomi-watch2',
    sizes: [],
    codes: [{ code: 'M2320W1', connectivity: 'bt' }],
    plausible: { min: 380, max: 2500 },
    launchYear: 2024,
    color: '#f97316',
  },
  {
    id: 'galaxy-watch8-classic',
    name: 'Samsung Galaxy Watch8 Classic',
    shortName: 'Watch8 Classic',
    brand: 'Samsung',
    primary: false,
    family: 'galaxy-watch8',
    sizes: [46],
    codes: [
      { code: 'SM-L500', size: 46, connectivity: 'bt' },
      { code: 'SM-L505', size: 46, connectivity: 'lte' },
    ],
    plausible: { min: 900, max: 6000 },
    launchYear: 2025,
    color: '#1e40af',
  },
  {
    id: 'galaxy-watch4-classic',
    name: 'Samsung Galaxy Watch4 Classic',
    shortName: 'Watch4 Classic',
    brand: 'Samsung',
    primary: false,
    family: 'galaxy-watch4',
    sizes: [42, 46],
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
    id: 'xiaomi-watch2-pro',
    name: 'Xiaomi Watch 2 Pro',
    shortName: 'Watch 2 Pro',
    brand: 'Xiaomi',
    primary: false,
    family: 'xiaomi-watch2',
    sizes: [],
    codes: [
      { code: 'M2234W1', connectivity: 'bt' },
      { code: 'M2233W1', connectivity: 'lte' },
    ],
    plausible: { min: 600, max: 3500 },
    launchYear: 2023,
    color: '#c2410c',
  },
];

const BY_ID = new Map(MODELS.map((m) => [m.id, m]));

export function getModel(id: ModelId): ModelSpec {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`Modelo desconhecido: ${id}`);
  return spec;
}

export const PRIMARY_MODELS = MODELS.filter((m) => m.primary);

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
