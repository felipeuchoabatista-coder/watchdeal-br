import { useMemo } from 'react';
import { getModel } from '../../../src/core/catalog.ts';
import type { DealEvent } from '../../../src/core/types.ts';
import { CopyButton, Empty } from '../components/bits.tsx';
import { Icon } from '../components/Icon.tsx';
import { ago, brl, REPO_URL, type AppData } from '../data.ts';

const TYPE_LABEL: Record<DealEvent['type'], string> = {
  'novo-minimo': 'Menor preço em 90 dias',
  'abaixo-alvo': 'Abaixo do alvo',
  imperdivel: 'Imperdível',
  'queda-preco': 'Queda de preço',
  'cupom-novo': 'Cupom novo',
};

function suggestedTopic(): string {
  const KEY = 'wd:ntfy';
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    const topic = `watchdeal-${crypto.getRandomValues(new Uint32Array(2)).join('').slice(0, 12)}`;
    localStorage.setItem(KEY, topic);
    return topic;
  } catch {
    return 'watchdeal-seu-codigo-secreto';
  }
}

export function Alerts({ data, now }: { data: AppData; now: number }) {
  const topic = useMemo(suggestedTopic, []);
  const secretsUrl = REPO_URL ? `${REPO_URL}/settings/secrets/actions` : undefined;
  const configUrl = REPO_URL ? `${REPO_URL}/edit/main/config/alertas.json` : undefined;

  return (
    <div className="page">
      <h1 className="page-title">Alertas</h1>
      <p className="muted small">
        O rastreador roda no GitHub a cada ~10 minutos, mesmo com o celular desligado, e avisa quando aparece:
      </p>
      <ul className="alert-types">
        <li><b>📉 Menor preço em 90 dias</b> para uma variante (ex.: Watch8 40mm Bluetooth).</li>
        <li><b>🎯 Abaixo do seu alvo</b> — o preço que você definiu para cada modelo.</li>
        <li><b>🔥 Imperdível</b> — Índice de Oferta 85 ou mais.</li>
        <li><b>⬇️ Queda de preço</b> de 5% ou mais numa oferta que já estava sendo acompanhada.</li>
        <li><b>🎟️ Cupom novo</b> que cita um dos relógios.</li>
      </ul>

      <section className="card">
        <h2 className="section-title">Receber no celular — opção 1: app ntfy (mais fácil)</h2>
        <ol className="steps">
          <li>Instale o app <b>ntfy</b> (<a href="https://play.google.com/store/apps/details?id=io.heckel.ntfy" target="_blank" rel="noopener noreferrer">Android</a> · <a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener noreferrer">iPhone</a>).</li>
          <li>
            No app, toque em <b>+</b> e inscreva-se neste tópico (é como uma senha — não compartilhe):
            <div className="code-line"><code>{topic}</code><CopyButton text={topic} /></div>
          </li>
          <li>
            No GitHub, crie o segredo <code>NTFY_TOPIC</code> com esse valor
            {secretsUrl ? <> em <a href={secretsUrl} target="_blank" rel="noopener noreferrer">Settings → Secrets → Actions</a></> : ' (Settings → Secrets and variables → Actions)'}.
          </li>
        </ol>
      </section>

      <section className="card">
        <h2 className="section-title">Opção 2: Telegram</h2>
        <ol className="steps">
          <li>No Telegram, fale com <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">@BotFather</a>, envie <code>/newbot</code> e copie o <b>token</b>.</li>
          <li>Abra o seu bot e envie qualquer mensagem (ex.: “oi”).</li>
          <li>Abra <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> e copie o número em <code>"chat":{'{'}"id": …</code>.</li>
          <li>Crie os segredos <code>TELEGRAM_BOT_TOKEN</code> e <code>TELEGRAM_CHAT_ID</code> no GitHub{secretsUrl ? <> (<a href={secretsUrl} target="_blank" rel="noopener noreferrer">abrir</a>)</> : ''}.</li>
        </ol>
      </section>

      <section className="card">
        <h2 className="section-title">Preço-alvo e preferências dos alertas</h2>
        <p className="small">
          Ficam no arquivo <code>config/alertas.json</code> do repositório. Dá para editar pelo próprio celular, no site do GitHub
          {configUrl ? <> — <a href={configUrl} target="_blank" rel="noopener noreferrer">editar agora <Icon name="external" size={12} /></a></> : ''}.
        </p>
        <pre className="snippet">{`"alvos": {
  "galaxy-watch8": 1100,
  "galaxy-watch-fe": 750,
  "galaxy-watch4": 650,
  "xiaomi-watch2": 700
}`}</pre>
      </section>

      <section aria-labelledby="h-events">
        <h2 id="h-events" className="section-title">Histórico de alertas</h2>
        {data.events.length === 0 ? (
          <Empty title="Nenhum alerta ainda">Assim que algo relevante acontecer, ele aparece aqui.</Empty>
        ) : (
          <ul className="events">
            {data.events.slice(0, 60).map((e) => (
              <li key={e.id} className={`event event--${e.type}`}>
                <div className="event__head">
                  <span className="event__type">{TYPE_LABEL[e.type]}</span>
                  <span className="muted">{ago(e.at, now)}</span>
                </div>
                <p>{e.message}</p>
                <div className="event__foot">
                  {e.model && <span className="tag">{getModel(e.model).shortName}</span>}
                  {e.price !== undefined && <span className="tag">{brl(e.price)}</span>}
                  {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer">abrir oferta <Icon name="external" size={12} /></a>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
