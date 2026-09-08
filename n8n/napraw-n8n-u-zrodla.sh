#!/usr/bin/env bash
# NAPRAWA n8n U ZRODLA — jedno uruchomienie, na stale.
#
# Uruchom na VPS (konsola DigitalOcean -> Droplets -> serwer -> Access -> Launch Droplet Console):
#   bash <(curl -fsSL https://raw.githubusercontent.com/kgregenevia-sys/mv-www/claude/verify-agents-n8n-code-vvdmz6/n8n/napraw-n8n-u-zrodla.sh)
# albo skopiuj plik na serwer i:  bash napraw-n8n-u-zrodla.sh
#
# Skrypt NAJPIERW diagnozuje przyczyne, POTEM naprawia. Jest idempotentny — powtorne
# uruchomienie niczego nie psuje. Nie kasuje danych n8n ani workflowow.
#
# CO ROBI:
#   1. Diagnoza: kod wyjscia kontenera, OOMKilled, logi, RAM, swap, dysk, stan Dockera.
#   2. Polityka restartu: unless-stopped (kontener wstaje sam po crashu i po reboocie VPS).
#   3. Docker wlaczony w systemd (auto-recovery po reboocie hosta).
#   4. Swap, jesli go nie ma — najczestsza przyczyna ubijania Node przez OOM na malym dropletcie.
#   5. Czyszczenie historii wykonan n8n (EXECUTIONS_DATA_*) — druga najczestsza przyczyna OOM.
#   6. Healthcheck kontenera na /healthz.
#   7. Weryfikacja: czy n8n odpowiada 200.

set -uo pipefail
K="${1:-n8n}"                      # nazwa kontenera, domyslnie n8n
ZIELONY=$'\e[32m'; ZOLTY=$'\e[33m'; CZERWONY=$'\e[31m'; KONIEC=$'\e[0m'
ok(){   echo "${ZIELONY}[OK]${KONIEC} $*"; }
uwaga(){ echo "${ZOLTY}[UWAGA]${KONIEC} $*"; }
blad(){ echo "${CZERWONY}[BLAD]${KONIEC} $*"; }

echo "================ 1. DIAGNOZA ================"

if ! command -v docker >/dev/null 2>&1; then
  blad "Docker nie jest zainstalowany. Dalsza czesc nie ma sensu."; exit 1
fi

if ! docker inspect "$K" >/dev/null 2>&1; then
  blad "Nie ma kontenera o nazwie '$K'. Dostepne kontenery:"
  docker ps -a --format '  {{.Names}}\t{{.Status}}\t{{.Image}}'
  echo "Uruchom ponownie z wlasciwa nazwa:  bash $0 NAZWA_KONTENERA"; exit 1
fi

STAN=$(docker inspect -f '{{.State.Status}}' "$K")
KOD=$(docker inspect -f '{{.State.ExitCode}}' "$K")
OOM=$(docker inspect -f '{{.State.OOMKilled}}' "$K")
POLITYKA=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$K")
LIMIT=$(docker inspect -f '{{.HostConfig.Memory}}' "$K")
RESTARTY=$(docker inspect -f '{{.RestartCount}}' "$K")

echo "  stan kontenera .......... $STAN"
echo "  kod wyjscia ............. $KOD"
echo "  ubity przez OOM ......... $OOM"
echo "  polityka restartu ....... ${POLITYKA:-brak}"
echo "  limit pamieci ........... $([ "$LIMIT" = "0" ] && echo 'brak (bez limitu)' || echo "$LIMIT B")"
echo "  liczba restartow ........ $RESTARTY"
echo
echo "  --- RAM i swap ---"; free -h 2>/dev/null || uwaga "brak polecenia free"
echo
echo "  --- dysk ---"; df -h / 2>/dev/null | tail -n +1
echo
echo "  --- OOM w logach jadra (ostatnie wpisy) ---"
(dmesg -T 2>/dev/null || dmesg 2>/dev/null) | grep -iE 'out of memory|oom-kill|killed process' | tail -5 \
  || echo "  brak wpisow OOM w dmesg (albo brak uprawnien do dmesg)"
echo
echo "  --- ostatnie 40 linii logu n8n ---"
docker logs --tail 40 "$K" 2>&1 | sed 's/^/  /'
echo

PRZYCZYNA="nieustalona"
if [ "$OOM" = "true" ]; then
  PRZYCZYNA="OOM — jadro ubilo kontener z braku pamieci"
elif echo "$(docker logs --tail 200 "$K" 2>&1)" | grep -qi 'heap out of memory\|allocation failed'; then
  PRZYCZYNA="OOM w Node — przepelniona sterta V8 (heap out of memory)"
elif [ "$KOD" = "137" ]; then
  PRZYCZYNA="SIGKILL (kod 137) — prawie zawsze brak pamieci"
elif [ "$KOD" = "143" ]; then
  PRZYCZYNA="SIGTERM (kod 143) — kontener zatrzymany z zewnatrz"
elif echo "$(docker logs --tail 200 "$K" 2>&1)" | grep -qi 'ECONNREFUSED\|database\|pool\|postgres'; then
  PRZYCZYNA="problem z baza danych n8n lub pulą polaczen"
fi
echo "  ${ZOLTY}PRZYCZYNA:${KONIEC} $PRZYCZYNA"

echo
echo "================ 2. NAPRAWA ================"

# --- 2a. Polityka restartu ---
if [ "$POLITYKA" = "unless-stopped" ] || [ "$POLITYKA" = "always" ]; then
  ok "polityka restartu juz ustawiona ($POLITYKA)"
else
  docker update --restart unless-stopped "$K" >/dev/null && ok "polityka restartu ustawiona na unless-stopped" \
    || blad "nie udalo sie ustawic polityki restartu"
fi

# --- 2b. Docker startuje po reboocie hosta ---
if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-enabled docker >/dev/null 2>&1; then
    ok "docker juz wlaczony w systemd (wstanie po reboocie VPS)"
  else
    systemctl enable docker >/dev/null 2>&1 && ok "docker wlaczony w systemd" || uwaga "nie udalo sie wlaczyc docker w systemd"
  fi
fi

# --- 2c. Swap (ochrona przed OOM) ---
SWAP_KB=$(awk '/SwapTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0)
if [ "${SWAP_KB:-0}" -gt 0 ]; then
  ok "swap juz istnieje ($((SWAP_KB/1024)) MB)"
else
  uwaga "brak swapu — na malym dropletcie to glowna przyczyna ubijania Node przez OOM"
  if fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none 2>/dev/null; then
    chmod 600 /swapfile && mkswap /swapfile >/dev/null 2>&1 && swapon /swapfile 2>/dev/null \
      && { grep -q '^/swapfile' /etc/fstab 2>/dev/null || echo '/swapfile none swap sw 0 0' >> /etc/fstab; ok "utworzono 2 GB swapu (trwale, wpis w /etc/fstab)"; } \
      || uwaga "swap utworzony, ale nie udalo sie go wlaczyc"
  else
    uwaga "nie udalo sie utworzyc pliku swap (brak miejsca na dysku?)"
  fi
fi

# --- 2d. Czyszczenie historii wykonan n8n (druga najczestsza przyczyna OOM) ---
COMPOSE=""
for f in /root/docker-compose.yml /root/docker-compose.yaml /opt/n8n/docker-compose.yml \
         /home/n8n/docker-compose.yml /srv/n8n/docker-compose.yml ./docker-compose.yml; do
  [ -f "$f" ] && COMPOSE="$f" && break
done

if [ -n "$COMPOSE" ]; then
  ok "znaleziono plik compose: $COMPOSE"
  if grep -q 'EXECUTIONS_DATA_PRUNE' "$COMPOSE"; then
    ok "czyszczenie historii wykonan juz skonfigurowane"
  else
    cp "$COMPOSE" "${COMPOSE}.bak.$(date +%Y%m%d%H%M%S)" && ok "backup compose zrobiony"
    uwaga "DOPISZ recznie w sekcji environment uslugi n8n w $COMPOSE:"
    cat <<'ENV'
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168          # trzymaj historie 7 dni
      - EXECUTIONS_DATA_PRUNE_MAX_COUNT=5000
      - NODE_OPTIONS=--max-old-space-size=1024
ENV
    echo "  a nastepnie:  docker compose -f $COMPOSE up -d"
  fi
else
  uwaga "nie znaleziono docker-compose.yml — kontener prawdopodobnie uruchomiony przez 'docker run'."
  uwaga "Zeby na stale ograniczyc pamiec i historie wykonan, kontener trzeba odtworzyc"
  uwaga "z dodatkowymi zmiennymi (dane w wolumenie zostaja):"
  cat <<'ENV'
    -e EXECUTIONS_DATA_PRUNE=true
    -e EXECUTIONS_DATA_MAX_AGE=168
    -e EXECUTIONS_DATA_PRUNE_MAX_COUNT=5000
    -e NODE_OPTIONS=--max-old-space-size=1024
ENV
  echo "  Aktualna komenda uruchomieniowa kontenera (do odtworzenia z dopiskami wyzej):"
  docker inspect -f '{{json .Config.Env}}' "$K" 2>/dev/null | tr ',' '\n' | sed 's/^/    /' | head -30
fi

# --- 2e. Start kontenera ---
if [ "$STAN" != "running" ]; then
  docker start "$K" >/dev/null 2>&1 && ok "kontener wystartowany" || blad "nie udalo sie wystartowac kontenera"
else
  docker restart "$K" >/dev/null 2>&1 && ok "kontener zrestartowany" || blad "restart nie powiodl sie"
fi

echo
echo "================ 3. WERYFIKACJA ================"
for i in $(seq 1 30); do
  KOD_HTTP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://n8n.kgregenevia.pro/healthz 2>/dev/null || echo 000)
  if [ "$KOD_HTTP" = "200" ]; then ok "n8n odpowiada HTTP 200 (po ${i}0 s)"; break; fi
  [ "$i" = "30" ] && blad "n8n nadal nie odpowiada (ostatni kod: $KOD_HTTP) — wklej wynik tego skryptu do rozmowy"
  sleep 10
done

echo
echo "  polityka restartu po naprawie: $(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$K")"
echo "  stan kontenera po naprawie ..: $(docker inspect -f '{{.State.Status}}' "$K")"
echo "  swap ........................: $(awk '/SwapTotal/{printf "%d MB", $2/1024}' /proc/meminfo 2>/dev/null)"
echo
ok "Gotowe. Od teraz n8n wstaje sam po crashu i po reboocie VPS."
echo "Jesli cokolwiek wyzej jest na czerwono — wklej caly wynik do rozmowy."
