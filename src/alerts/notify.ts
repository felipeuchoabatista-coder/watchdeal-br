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
  teste: '✅',
};

const TITLE: Record<DealEventType, string> = {
  'novo-minimo': 'Menor preço em 90 dias',
  'abaixo-alvo': 'Abaixo do seu preço-alvo',
  imperdivel: 'Oferta imperdível',
  'queda-preco': 'Preço caiu',
  'cupom-novo': 'Cupom novo',
  teste: 'Teste de alerta',
};

const URGENT = new Set<DealEventType>(['abaixo-alvo', 'imperdivel']);

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
      if (!res.ok) {
        const body = (await res.text()).slice(0, 200);
        const hint = res.status === 401 || res.status === 404
          ? ' (token do robô inválido ou revogado: confira o segredo TELEGRAM_BOT_TOKEN)'
          : res.status === 403
            ? ' (o robô não pode te escrever: abra a conversa com ele e toque em Iniciar)'
            : /chat not found/i.test(body)
              ? ' (TELEGRAM_CHAT_ID errado, ou você ainda não tocou em Iniciar no robô)'
              : '';
        throw new Error(`Telegram respondeu ${res.status}${hint}: ${body}`);
      }
    },
  };
}

export function ntfyChannel(topic: string, server = 'https://ntfy.sh'): Channel {
  return {
    name: 'ntfy',
    async send(event, appUrl) {
      const model = event.model ? getModel(event.model).shortName : 'WatchDeal';
      const actions = [
        event.url ? { action: 'view', label: 'Abrir oferta', url: event.url, clear: true } : null,
        appUrl ? { action: 'view', label: 'WatchDeal', url: appUrl } : null,
      ].filter(Boolean);
      // Publicação em JSON: aceita acentos e emojis no título sem codificação de cabeçalho.
      const res = await fetch(server.replace(/\/$/, ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          title: `${TITLE[event.type]} · ${model}`,
          message: `${ICON[event.type]} ${event.message}`,
          tags: URGENT.has(event.type) ? ['fire', 'watch'] : ['watch'],
          priority: URGENT.has(event.type) ? 5 : 3,
          click: event.url ?? appUrl,
          actions,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`ntfy respondeu ${res.status}`);
    },
  };
}

export function channelsFromEnv(config: AlertConfig, env: NodeJS.ProcessEnv = process.env): Channel[] {
  const channels: Channel[] = [];
  // Segredos colados pelo celular costumam vir com espaço ou quebra de linha nas pontas.
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  const topic = env.NTFY_TOPIC?.trim();
  if (config.canais.telegram && token && chatId) {
    channels.push(telegramChannel(token, chatId));
  }
  if (config.canais.ntfy && topic) {
    channels.push(ntfyChannel(topic, env.NTFY_SERVER?.trim() || undefined));
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
