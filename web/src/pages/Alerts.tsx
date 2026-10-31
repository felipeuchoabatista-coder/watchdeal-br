import { getModel } from '../../../src/core/catalog.ts';
import type { DealEvent } from '../../../src/core/types.ts';
import { Empty } from '../components/bits.tsx';
import { Icon } from '../components/Icon.tsx';
import { ago, brl, REPO_URL, type AppData } from '../data.ts';

const TYPE_LABEL: Record<DealEvent['type'], string> = {
  'novo-minimo': 'Menor preço em 90 dias',
  'abaixo-alvo': 'Abaixo do alvo',
  imperdivel: 'Imperdível',
  'queda-preco': 'Queda de preço',
  'cupom-novo': 'Cupom novo',
  teste: 'Teste',
};

export function Alerts({ data, now }: { data: AppData; now: number }) {
  const secretsUrl = REPO_URL ? `${REPO_URL}/settings/secrets/actions` : undefined;
  const configUrl = REPO_URL ? `${REPO_URL}/edit/main/config/alertas.json` : undefined;
  const workflowUrl = REPO_URL ? `${REPO_URL}/actions/workflows/coletar.yml` : undefined;

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

      <p className="small">Dá para usar os dois canais ao mesmo tempo: cada alerta chega no ntfy e no Telegram.</p>

      <section className="card">
        <h2 className="section-title">ntfy — notificação no celular</h2>
        <ol className="steps">
          <li>Instale o app <b>ntfy</b> (<a href="https://play.google.com/store/apps/details?id=io.heckel.ntfy" target="_blank" rel="noopener noreferrer">Android</a> · <a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener noreferrer">iPhone</a>).</li>
          <li>Toque em <b>+</b> e inscreva-se no seu tópico secreto — o mesmo valor guardado no segredo <code>NTFY_TOPIC</code> do GitHub. Ele funciona como uma senha: não compartilhe.</li>
          <li>Para tocar mesmo no silencioso: nas configurações do tópico, permita <b>alertas de prioridade máxima</b>.</li>
        </ol>
      </section>

      <section className="card">
        <h2 className="section-title">Telegram — mensagem de um robô</h2>
        <ol className="steps">
          <li>Fale com <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">@BotFather</a>, envie <code>/newbot</code>, escolha um nome e copie o <b>token</b>.</li>
          <li>Abra o seu robô e toque em <b>Iniciar</b> (sem isso ele não pode te escrever).</li>
          <li>Fale com <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer">@userinfobot</a>: ele responde com o seu <b>Id</b> (um número).</li>
          <li>Crie os segredos <code>TELEGRAM_BOT_TOKEN</code> (o token) e <code>TELEGRAM_CHAT_ID</code> (o Id) no GitHub{secretsUrl ? <> — <a href={secretsUrl} target="_blank" rel="noopener noreferrer">abrir segredos <Icon name="external" size={12} /></a></> : ''}.</li>
        </ol>
      </section>

      <section className="card">
        <h2 className="section-title">Testar os alertas</h2>
        <p className="small">
          Em {workflowUrl ? <a href={workflowUrl} target="_blank" rel="noopener noreferrer">Actions → Coletar ofertas</a> : 'Actions → Coletar ofertas'}, toque em <b>Run workflow</b>, marque <b>Enviar um alerta de teste</b> e confirme. Em cerca de 1 minuto chega um “✅ Teste de alerta” em cada canal configurado.
        </p>
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
