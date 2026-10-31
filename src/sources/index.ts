import { amazon } from './amazon.ts';
import { kabum } from './kabum.ts';
import { pelando } from './pelando.ts';
import { promobit } from './promobit.ts';
import { samsung } from './samsung.ts';
import type { Source } from './source.ts';
import { zoom } from './zoom.ts';

/** Ordem = prioridade quando a mesma oferta aparece em mais de uma fonte. */
export const SOURCES: Source[] = [samsung, kabum, amazon, zoom, promobit, pelando];

export const SOURCE_PRIORITY = new Map(SOURCES.map((s, i) => [s.id, i]));
