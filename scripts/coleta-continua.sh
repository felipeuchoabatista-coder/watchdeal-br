#!/usr/bin/env bash
# Coleta contínua, usada pelo workflow "Coletar ofertas".
#
# Roda uma coleta a cada 5 minutos por ~5 h 15 min e grava os dados no branch
# "data" depois de cada rodada. Desde o começo deixa a próxima execução do
# workflow esperando na fila: o "concurrency" do workflow a segura até esta
# terminar. Assim:
#   - se esta execução morrer no meio, a da fila assume na hora;
#   - uma falha passageira do GitHub (API, git) só atrasa uma rodada. A
#     gravação e o disparo da próxima são tentados de novo nas rodadas seguintes.
#
# Antes, cada execução durava 5 min e agendava a seguinte. Eram 288 passagens
# de bastão por dia, e bastava uma falhar para a coleta parar até alguém
# religar. Foi o que aconteceu em 04/11 às 15:56: o GitHub mostrou como "em
# andamento", por 20 min, uma execução que já tinha terminado.
#
# Variáveis de ambiente:
#   GH_TOKEN, GH_REPO, GITHUB_REPOSITORY, GITHUB_RUN_NUMBER, GITHUB_SHA  (workflow)
#   INICIO        início do job, em segundos desde 1970 (padrão: agora)
#   FORCAR        "true": a 1ª rodada consulta todas as fontes
#   CONTINUA      "false": uma rodada só, sem deixar outra na fila
#   INTERVALO     segundos entre o início de duas rodadas (300)
#   DURACAO       depois disso passa o bastão e sai (18900 = 5 h 15)
#   LIMITE        depois disso sai mesmo sem conseguir passar o bastão (19800 = 5 h 30)
#   CHECAGEM      de quanto em quanto tempo olha a fila durante a espera (60)
#   TEMPO_RODADA  tempo máximo de uma rodada (540)
#   ESPERA_DISPARO depois de disparar a próxima, quanto esperar ela aparecer
#                 na lista antes de disparar de novo (900)

set -uo pipefail

INICIO=${INICIO:-$(date +%s)}
FORCAR=${FORCAR:-false}
CONTINUA=${CONTINUA:-true}
INTERVALO=${INTERVALO:-300}
DURACAO=${DURACAO:-18900}
LIMITE=${LIMITE:-19800}
CHECAGEM=${CHECAGEM:-60}
TEMPO_RODADA=${TEMPO_RODADA:-540}
ESPERA_DISPARO=${ESPERA_DISPARO:-900}

agora() { date +%s; }
decorrido() { echo $(($(agora) - INICIO)); }
hora() { date -u +%H:%M; }

# Execuções deste workflow MAIS NOVAS que esta e ainda não terminadas (JSON).
# As mais antigas ficam de fora de propósito: foi uma delas, mostrada como
# "em andamento" depois de terminar, que parou a coleta em 04/11.
fila() {
  gh api "repos/$GH_REPO/actions/workflows/coletar.yml/runs?per_page=10" --jq "[.workflow_runs[]
    | select(.run_number > $GITHUB_RUN_NUMBER and .status != \"completed\")
    | {event, por: .triggering_actor.login, sha: .head_sha}]"
}

# Na fila há uma execução que deve assumir já: pedida por uma pessoa (Run
# workflow, push no main) ou com outro código (o main mudou)?
deve_assumir() {
  [ "$(jq --arg sha "$GITHUB_SHA" '[.[] | select(.event == "push"
      or (.event == "workflow_dispatch" and .por != "github-actions[bot]")
      or .sha != $sha)] | length' <<<"$1")" -gt 0 ]
}

disparar() { gh workflow run coletar.yml --ref main; }

ultimo_disparo=0

# Deixa uma próxima execução na fila, se ainda não houver.
garantir_proxima() {
  [ "$(jq length <<<"$1")" -gt 0 ] && return 0
  # Disparou há pouco e ela ainda não aparece na lista: dá tempo ao GitHub.
  [ $(($(agora) - ultimo_disparo)) -lt "$ESPERA_DISPARO" ] && return 0
  if disparar; then
    ultimo_disparo=$(agora)
    echo "$(hora) Próxima execução deixada na fila."
  else
    echo "$(hora) Não consegui deixar a próxima execução na fila; tento de novo em instantes."
  fi
}

# Um único commit sempre (force push): o histórico de preços vive nos próprios
# arquivos, então o branch não cresce para sempre. Se o push falhar, a próxima
# rodada envia tudo de novo.
salvar() {
  [ -f data/ofertas.json ] || { echo "Nada para salvar."; return 0; }
  (
    cd data || exit 1
    rm -rf .git
    git init --quiet -b data &&
      git config user.name "watchdeal-bot" &&
      git config user.email "41898282+github-actions[bot]@users.noreply.github.com" &&
      git add -A &&
      git commit --quiet -m "dados $(date -u +%Y-%m-%dT%H:%MZ)" || exit 1
    for n in 1 2 3; do
      git push --quiet --force "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" data && exit 0
      [ "$n" -lt 3 ] && sleep $((10 * n))
    done
    exit 1
  )
}

rodada=0
salvas=0
motivo=""
while :; do
  t0=$(agora)
  rodada=$((rodada + 1))
  forcar=""
  [ "$rodada" -eq 1 ] && [ "$FORCAR" = true ] && forcar="--forcar"
  echo "::group::Rodada $rodada · $(hora) UTC"
  # A coleta não precisa do token do GitHub; ele fica só com este script.
  timeout --kill-after=30 "$TEMPO_RODADA" env -u GH_TOKEN node --disable-warning=ExperimentalWarning src/run.ts $forcar ||
    echo "::warning::A rodada $rodada terminou com erro; sigo na próxima."
  if salvar; then
    salvas=$((salvas + 1))
  else
    echo "::warning::Não consegui gravar no branch data; tento de novo na próxima rodada."
  fi
  echo "::endgroup::"

  [ "$CONTINUA" = true ] || break

  # Hora de passar o bastão: sai assim que houver uma próxima na fila. Sem
  # conseguir, continua coletando e tenta de novo na rodada seguinte.
  if [ "$(decorrido)" -ge "$DURACAO" ]; then
    if f=$(fila) && [ "$(jq length <<<"$f")" -gt 0 ]; then motivo=fila; break; fi
    if disparar; then motivo=disparada; break; fi
    if [ "$(decorrido)" -ge "$LIMITE" ]; then motivo=falhou; break; fi
  fi

  # Espera a próxima rodada olhando a fila a cada minuto.
  proxima=$((t0 + INTERVALO))
  while :; do
    if f=$(fila); then
      if deve_assumir "$f"; then motivo=assumir; break 2; fi
      garantir_proxima "$f"
    fi
    resto=$((proxima - $(agora)))
    [ "$resto" -gt 0 ] || break
    sleep $((resto < CHECAGEM ? resto : CHECAGEM))
  done
done

case "$motivo" in
  assumir) echo "Há uma execução nova na fila (pedida por você ou com código novo); encerro para ela assumir." ;;
  fila) echo "A próxima execução já está na fila; encerrando." ;;
  disparada) echo "Próxima execução disparada; encerrando." ;;
  falhou) echo "::error::Não consegui deixar a próxima execução na fila (GitHub fora do ar?)." ;;
esac
echo "$rodada rodada(s), $salvas gravada(s) no branch data."
[ "$salvas" -gt 0 ] && [ "$motivo" != falhou ]
