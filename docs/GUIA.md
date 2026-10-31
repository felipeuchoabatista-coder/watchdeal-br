# Guia do WatchDeal BR

## 1. Publicar no GitHub (uma vez)

O repositório precisa ser **público** para o GitHub Actions rodar de graça a cada 10 minutos. O código fica visível, mas as senhas (tokens de alerta) ficam protegidas em *Secrets*.

1. Crie o repositório e envie o código (`git push`).
2. Em **Settings → Pages**, escolha **Source: GitHub Actions**.
3. Em **Actions → Coletar ofertas → Run workflow**, marque *Consultar todas as fontes agora* e rode.
4. Em ~2 minutos o app estará em `https://<seu-usuário>.github.io/<repositório>/`.

A partir daí, a coleta roda sozinha a cada ~10 minutos. Os dados ficam no branch `data`.

## 2. Instalar no celular

- **Android (Chrome):** abra o endereço do app e toque em **Instalar** no aviso que aparece, ou no menu ⋮ → **Instalar app**.
- **iPhone (Safari):** abra o endereço, toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início**.

O app abre em tela cheia, atualiza sozinho e mostra a última coleta mesmo sem internet.

## 3. Receber alertas no celular

Escolha um canal (ou os dois). Sem nenhum configurado, os alertas aparecem só na aba **Alertas** do app.

### Opção A — ntfy (mais simples)

1. Instale o app **ntfy** ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) · [iPhone](https://apps.apple.com/app/ntfy/id1625396347)).
2. Escolha um nome de tópico difícil de adivinhar. A aba **Alertas** do WatchDeal sugere um. No ntfy, toque em **+** e inscreva-se nele.
3. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   - Nome: `NTFY_TOPIC`
   - Valor: o tópico

### Opção B — Telegram

1. Fale com [@BotFather](https://t.me/BotFather), envie `/newbot` e guarde o **token**.
2. Abra o seu bot e mande qualquer mensagem.
3. Acesse `https://api.telegram.org/bot<TOKEN>/getUpdates` e copie o número em `"chat":{"id": …}`.
4. Crie os secrets `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`.

Na primeira coleta não é enviado nenhum alerta, para evitar uma enxurrada. Depois, cada alerta é enviado no máximo uma vez por semana.

## 4. Preço-alvo e preferências

Edite `config/alertas.json` direto no site do GitHub (dá para fazer pelo celular). Ao salvar, a coleta roda na hora.

```json
{
  "alvos": { "galaxy-watch8": 1100, "galaxy-watch-fe": 750, "galaxy-watch4": 650, "xiaomi-watch2": 700 },
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
| `incluirVariantesOcultas` | Também alerta Watch8 Classic, Watch4 Classic e Xiaomi Watch 2 Pro. |

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
