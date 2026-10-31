import { useCallback, useEffect, useState } from 'react';
import type { ModelId } from '../../src/core/types.ts';

/**
 * Preferências deste aparelho (localStorage). Tudo é opcional: se o navegador
 * bloquear o armazenamento, o app funciona com os padrões.
 */
export interface Prefs {
  showHidden: boolean;
  includeUsed: boolean;
  onlyCoupon: boolean;
  sort: 'indice' | 'preco' | 'recentes';
  targets: Partial<Record<ModelId, number>>;
  theme: 'auto' | 'light' | 'dark';
}

const DEFAULTS: Prefs = {
  showHidden: false,
  includeUsed: false,
  onlyCoupon: false,
  sort: 'indice',
  targets: {},
  theme: 'auto',
};

const KEY = 'wd:prefs';

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function applyTheme(theme: Prefs['theme']) {
  const el = document.documentElement;
  if (theme === 'auto') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('wd:tema', theme);
  } catch {
    /* sem armazenamento: tema vale só nesta sessão */
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(read);

  useEffect(() => {
    applyTheme(prefs.theme);
  }, [prefs.theme]);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignora */
      }
      return next;
    });
  }, []);

  return [prefs, update] as const;
}
