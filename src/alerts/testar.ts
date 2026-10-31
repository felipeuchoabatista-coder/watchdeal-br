import { join } from 'node:path';
import { loadConfig } from '../store.ts';
import type { DealEvent } from '../core/types.ts';
import { channelsFromEnv } from './notify.ts';

/**
 * Envia um alerta de teste para todos os canais configurados (Telegram e/ou ntfy).
 * Uso: npm run testar-alertas   (no GitHub: Actions → Coletar ofertas → "Testar alertas")
 */

const config = await loadConfig(join(process.cwd(), 'config', 'alertas.json'));
const channels = channelsFromEnv(config);
const appUrl = process.env.WATCHDEAL_APP_URL;

console.log(`Telegram: ${process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID ? 'configurado' : 'não configurado'}${config.canais.telegram ? '' : ' (desligado em config/alertas.json)'}`);
console.log(`ntfy: ${process.env.NTFY_TOPIC ? 'configurado' : 'não configurado'}${config.canais.ntfy ? '' : ' (desligado em config/alertas.json)'}`);

if (channels.length === 0) {
  console.error('Nenhum canal de alerta configurado. Veja docs/GUIA.md, seção 3.');
  process.exitCode = 1;
} else {
  const event: DealEvent = {
    id: `teste-${Date.now()}`,
    at: new Date().toISOString(),
    type: 'teste',
    title: 'Teste do WatchDeal BR',
    message: 'Os alertas estão funcionando. Você será avisado de quedas de preço, mínimos históricos e cupons dos seus relógios.',
    url: appUrl,
  };
  let failures = 0;
  for (const ch of channels) {
    try {
      await ch.send(event, appUrl);
      console.log(`✓ ${ch.name}: enviado`);
    } catch (err) {
      failures++;
      console.error(`✗ ${ch.name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (failures) process.exitCode = 1;
}
