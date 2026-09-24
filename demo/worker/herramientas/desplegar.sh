#!/usr/bin/env bash
# Despliega el servidor de avisos en Cloudflare de una sola vez, sin
# preguntas. Hace falta CLOUDFLARE_API_TOKEN (plantilla "Edit Cloudflare
# Workers"). Es idempotente: si el KV o el secreto ya existen, los reutiliza.
#
#   worker/herramientas/desplegar.sh [nombre-del-worker]
#
# El nombre por defecto (avisos-app) es el de wrangler.jsonc; para tener
# varios workers en la misma cuenta (uno por app), pásale un nombre.
set -euo pipefail
NOMBRE="${1:-avisos-app}"
: "${CLOUDFLARE_API_TOKEN:?Falta CLOUDFLARE_API_TOKEN en el entorno}"
cd "$(dirname "$0")/.."

echo "· Herramienta de despliegue"
[ -d node_modules/wrangler ] || npm install --no-audit --no-fund --silent wrangler@4 >/dev/null
W="npx --no-install wrangler"

echo "· Cuenta"
$W whoami 2>/dev/null | grep -iE "account|cuenta" | head -5 || true

echo "· Almacén KV"
TITULO_KV="avisos-app-AVISOS"
ID=$($W kv namespace list 2>/dev/null | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try { const l = JSON.parse(s); const n = l.find((x) => x.title === process.argv[1]); console.log(n ? n.id : ""); } catch { console.log(""); }
  });' "$TITULO_KV")
if [ -z "$ID" ]; then
  SALIDA=$($W kv namespace create AVISOS 2>&1)
  ID=$(echo "$SALIDA" | grep -oE '"id": *"[0-9a-f]+"' | grep -oE '[0-9a-f]{20,}' | head -1)
  [ -n "$ID" ] || { echo "No pude crear el KV:"; echo "$SALIDA"; exit 1; }
  echo "  creado: $ID"
else
  echo "  ya existía: $ID"
fi
sed -i -E "s/\"id\": *\"[^\"]*\"/\"id\": \"$ID\"/" wrangler.jsonc

echo "· Claves VAPID"
CLAVES="CLAVES-VAPID.local.json"
if [ -f "$CLAVES" ]; then
  echo "  reutilizo $CLAVES (si se cambian, todos los móviles tienen que reactivar)"
else
  node herramientas/generar-claves.mjs --json > "$CLAVES"
  echo "  generadas y guardadas en worker/$CLAVES (guárdalo en un sitio seguro; no va a git)"
fi
JWK=$(node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).privada))' "$CLAVES")
printf '%s' "$JWK" | $W secret put VAPID_PRIVADA_JWK --name "$NOMBRE" >/dev/null
echo "  secreto VAPID_PRIVADA_JWK puesto en $NOMBRE"

echo "· Despliegue de $NOMBRE"
SALIDA=$($W deploy --name "$NOMBRE" 2>&1) || { echo "$SALIDA"; exit 1; }
URL=$(echo "$SALIDA" | grep -oE 'https://[a-z0-9.-]+\.workers\.dev' | head -1)
[ -n "$URL" ] || { echo "Desplegado, pero no encuentro la URL en la salida:"; echo "$SALIDA"; exit 1; }
echo "  $URL"

echo "· Comprobación"
SALUD=$(curl -sS -m 20 "$URL/api/avisos/salud" || true)
echo "  salud: $SALUD"
CLAVE=$(curl -sS -m 20 "$URL/api/avisos/clave" || true)
echo "  clave: ${CLAVE:0:40}…"

echo "· La app"
sed -i -E "s#export const URL_AVISOS = \"[^\"]*\";#export const URL_AVISOS = \"$URL\";#" ../js/config-avisos.js
grep -n "URL_AVISOS" ../js/config-avisos.js
echo
echo "LISTO: URL_AVISOS=$URL"
