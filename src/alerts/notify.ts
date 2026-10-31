import { getModel } from '../core/catalog.ts';
import type { AlertConfig, DealEvent, DealEventType } from '../core/types.ts';

/**
 * Envio de alertas para o celular. Canais gratuitos:
 *  - Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 *  - ntfy (app ntfy no Android/iPhone): NTFY_TOPIC (+ NTFY_SERVER opcional)
 * Sem as variáveis, o canal é ignorado silenciosamente.
 */

const ICON: Record<DealEventType, string> = {
  'novo-minimo': '📉',
  'abaixo-alvo': '🎯',
  imperdivel: '🔥',
  'queda-preco': '⬇️',
  'cupom-novo': '🎟️',
};

const TITLE: Record<DealEventType, string> = {
  'novo-minimo': 'Menor preço em 90 dias',
  'abaixo-alvo': 'Abaixo do seu preço-alvo',
  imperdivel: 'Oferta imperdível',
  'queda-preco': 'Preço caiu',
  'cupom-novo': 'Cupom novo',
};

export interface Channel {
  name: string;
  send(event: DealEvent, appUrl?: string): Promise<void>;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function telegramChannel(token: string, chatId: string): Channel {
  return {
    name: 'telegram',
    async send(event, appUrl) {
      const model = event.model ? getModel(event.model).shortName : '';
      const lines = [
        `${ICON[event.type]} <b>${escapeHtml(TITLE[event.type])}</b>${model ? ` · ${escapeHtml(model)}` : ''}`,
        escapeHtml(event.message),
        event.title ? `<i>${escapeHtml(event.title.slice(0, 140))}</i>` : '',
      ].filter(Boolean);
      const buttons = [
        event.url ? [{ text: '🛒 Abrir oferta', url: event.url }] : [],
        appUrl ? [{ text: '📊 Ver no WatchDeal', url: appUrl }] : [],
      ].filter((row) => row.length);
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: lines.join('\n'),
          parse_mode: 'HTML',
          disable_web_page_preview: false,
          reply_markup: buttons.length ? { inline_keyboard: buttons } : undefined,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Telegram respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
    },
  };
}

export function ntfyChannel(topic: string, server = 'https://ntfy.sh'): Channel {
  return {
    name: 'ntfy',
    async send(event, appUrl) {
      const model = event.model ? getModel(event.model).shortName : 'WatchDeal';
      const actions = [
        event.url ? `view, Abrir oferta, ${event.url}` : '',
        appUrl ? `view, WatchDeal, ${appUrl}` : '',
      ].filter(Boolean).join('; ');
      const res = await fetch(`${server.replace(/\/$/, '')}/${encodeURIComponent(topic)}`, {
        method: 'POST',
        headers: {
          // Cabeçalhos HTTP só aceitam ASCII; o título vai codificado (RFC 2047).
          Title: `=?UTF-8?B?${Buffer.from(`${TITLE[event.type]} · ${model}`).toString('base64')}?=`,
          Tags: event.type === 'imperdivel' || event.type === 'abaixo-alvo' ? 'fire,watch' : 'watch',
          Priority: event.type === 'abaixo-alvo' || event.type === 'imperdivel' ? '5' : '3',
          ...(event.url ? { Click: event.url } : {}),
          ...(actions ? { Actions: actions } : {}),
        },
        body: `${ICON[event.type]} ${event.message}`,
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`ntfy respondeu ${res.status}`);
    },
  };
}

export function channelsFromEnv(config: AlertConfig, env: NodeJS.ProcessEnv = process.env): Channel[] {
  const channels: Channel[] = [];
  if (config.canais.telegram && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    channels.push(telegramChannel(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID));
  }
  if (config.canais.ntfy && env.NTFY_TOPIC) {
    channels.push(ntfyChannel(env.NTFY_TOPIC, env.NTFY_SERVER || undefined));
  }
  return channels;
}

/** Evita repetir o mesmo alerta: cada chave é enviada no máximo uma vez a cada 7 dias. */
export const ALERT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function pendingAlerts(events: DealEvent[], sent: Record<string, string>, now: Date): DealEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    const last = sent[e.id];
    return !last || now.getTime() - new Date(last).getTime() > ALERT_TTL_MS;
  });
}
