# Guia do WatchDeal BR

## 1. Publicar no GitHub (uma vez)

O repositório precisa ser **público** para o GitHub Actions rodar de graça a cada 5 minutos. O código fica visível, mas as senhas (tokens de alerta) ficam protegidas em *Secrets*.

1. Crie o repositório e envie o código (`git push`).
2. Em **Settings → Pages**, escolha **Source: GitHub Actions**.
3. Em **Actions → Publicar app → Run workflow**, rode para publicar o app. Depois, em **Actions → Coletar ofertas → Run workflow**, marque *Consultar todas as fontes agora* e rode.
4. Em ~2 minutos o app estará em `https://<seu-usuário>.github.io/<repositório>/`.

A partir daí, a coleta roda sozinha a cada ~5 minutos: cada execução agenda a próxima. Os dados ficam no branch `data`, e o app os lê direto de lá: o site só é republicado quando o código muda (todo `git push` no `main` faz isso). Para pausar, crie a variável `COLETA_CONTINUA` = `false` em **Settings → Secrets and variables → Actions → Variables**.

## 2. Instalar no celular

- **Android (Chrome):** abra o endereço do app e toque em **Instalar** no aviso que aparece, ou no menu ⋮ → **Instalar app**.
- **iPhone (Safari):** abra o endereço, toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início**.

O app abre em tela cheia, atualiza sozinho e mostra a última coleta mesmo sem internet.

## 3. Receber alertas no celular

Os dois canais podem ficar ativos ao mesmo tempo: cada alerta chega no ntfy e no Telegram. Sem nenhum configurado, os alertas aparecem só na aba **Alertas** do app.

### ntfy — notificação no celular

1. Instale o app **ntfy** ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) · [iPhone](https://apps.apple.com/app/ntfy/id1625396347)).
2. Toque em **+** e inscreva-se no seu tópico secreto. Ele é o valor do segredo `NTFY_TOPIC` no GitHub.
3. Para tocar mesmo no silencioso: nas configurações do tópico, permita alertas de prioridade máxima. São usados para "abaixo do alvo" e "imperdível".

Para trocar o tópico, crie outro nome difícil de adivinhar e atualize o segredo `NTFY_TOPIC` em **Settings → Secrets and variables → Actions**.

### Telegram — mensagem de um robô

1. Fale com [@BotFather](https://t.me/BotFather), envie `/newbot`, escolha um nome e guarde o **token**.
2. Abra o seu robô e toque em **Iniciar**. Sem isso, ele não consegue te enviar mensagens.
3. Fale com [@userinfobot](https://t.me/userinfobot): ele responde com o seu **Id** (um número).
4. No GitHub, em **Settings → Secrets and variables → Actions → New repository secret**, crie:
   - `TELEGRAM_BOT_TOKEN` = o token
   - `TELEGRAM_CHAT_ID` = o Id

### Testar

Em **Actions → Coletar ofertas → Run workflow**, marque **Enviar um alerta de teste (ntfy/Telegram)** e confirme. Em cerca de 1 minuto chega um "✅ Teste de alerta" em cada canal configurado. O log da execução mostra quais canais estão configurados, sem expor os segredos.

Na primeira coleta não é enviado nenhum alerta, para evitar uma enxurrada. Depois, cada alerta é enviado no máximo uma vez por semana.

## 4. Preço-alvo e preferências

Edite `config/alertas.json` direto no site do GitHub (dá para fazer pelo celular). Ao salvar, a coleta roda na hora.

```json
{
  "alvos": { "galaxy-watch8": 1100, "galaxy-watch-fe": 950, "galaxy-watch4": 900, "xiaomi-watch2": 800 },
  "alertarNovoMinimo": true,
  "indiceMinimo": 85,
  "incluirUsados": false,
  "incluirVariantesOcultas": false,
  "canais": { "telegram": true, "ntfy": true }
}
```

| Campo | O que faz |
|---|---|
| `alvos` | Preço (à vista, produto novo) abaixo do qual você quer ser avisado. `null` desliga. |
| `alertarNovoMinimo` | Avisa quando surge o menor preço dos últimos 90 dias de uma variante. |
| `indiceMinimo` | Índice de Oferta a partir do qual a oferta conta como "imperdível" (padrão 85). |
| `incluirUsados` | Também alerta usados e recondicionados. |
| `incluirVariantesOcultas` | Também alerta Watch8 Classic, Watch6 Classic, Watch5 Pro, Watch4 Classic, Xiaomi Watch 2 Pro e TicWatch Pro 5 Enduro. |

Nomes dos modelos para usar em `alvos`:

| Modelo | Nome em `alvos` |
|---|---|
| Galaxy Watch Ultra | `galaxy-watch-ultra` |
| Galaxy Watch8 / Watch8 Classic | `galaxy-watch8` / `galaxy-watch8-classic` |
| Galaxy Watch7 | `galaxy-watch7` |
| Galaxy Watch FE | `galaxy-watch-fe` |
| Galaxy Watch6 / Watch6 Classic | `galaxy-watch6` / `galaxy-watch6-classic` |
| Galaxy Watch5 / Watch5 Pro | `galaxy-watch5` / `galaxy-watch5-pro` |
| Galaxy Watch4 / Watch4 Classic | `galaxy-watch4` / `galaxy-watch4-classic` |
| Xiaomi Watch 2 / Watch 2 Pro | `xiaomi-watch2` / `xiaomi-watch2-pro` |
| TicWatch Pro 5 / Pro 5 Enduro | `ticwatch-pro5` / `ticwatch-pro5-enduro` |
| TicWatch Atlas | `ticwatch-atlas` |

O campo de preço-alvo dentro do app só destaca ofertas naquele aparelho. A notificação usa o arquivo acima.

## 5. Problemas comuns

**"Os dados não são atualizados há X"**
O GitHub pausa agendamentos de repositórios públicos sem atividade por 60 dias. Em **Actions → Coletar ofertas**, clique em **Enable workflow**. A aba **Fontes** do app mostra a última coleta de cada loja.

**Uma fonte aparece como "Bloqueada"**
O site recusou o acesso automático naquele momento. O WatchDeal não tenta burlar o bloqueio: ele tenta de novo na próxima rodada e segue com as outras fontes.

**A coleta falhou (e-mail do GitHub)**
Só acontece quando todas as fontes falham ao mesmo tempo, quase sempre por instabilidade passageira. Se repetir, abra o log em **Actions**.

**Quero forçar uma coleta agora**
Vá em **Actions → Coletar ofertas → Run workflow** e marque *Consultar todas as fontes agora*.

**O app mostra "Última coleta há 1 h" (ou mais)**
Confira em **Actions → Coletar ofertas** se as execuções estão verdes e no branch `data` se o último commit é recente. Os dados levam até ~5 minutos a mais para aparecer, por causa do cache do GitHub. Se o app em si estiver desatualizado (tela antiga), rode **Actions → Publicar app → Run workflow**.

Se a última execução tiver mais de 10 minutos e nenhuma estiver na fila, a corrente de coletas parou. Isso acontece quando a API do GitHub fica fora do ar por mais de ~8 minutos seguidos. Rode **Actions → Coletar ofertas → Run workflow** uma vez, e ela volta a se agendar sozinha. O agendamento de reserva do GitHub (cron) também religa a corrente, mas pode levar horas.
