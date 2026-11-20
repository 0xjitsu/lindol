#!/usr/bin/env bash
# Verify a deployed Lindol URL: preview tags, every referenced asset (200 + content-type), the MP4 and the player page.
# Usage: scripts/check-live.sh https://lindol-one.vercel.app
set -uo pipefail
BASE="${1:-}"
if [[ -z "$BASE" ]]; then echo "usage: $0 <base-url>" >&2; exit 2; fi
BASE="${BASE%/}"
FAILS=0
fail() { echo "FAIL: $*" >&2; FAILS=$((FAILS + 1)); }
ok() { echo "ok:   $*"; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# head <path-or-url> -> sets STATUS, CTYPE, SIZE (downloaded body size) and writes body to $TMP/body
fetch() {
  local url="$1"; [[ "$url" == /* ]] && url="$BASE$url"
  local out
  out="$(curl -sL --max-time 60 -o "$TMP/body" -w '%{http_code}|%{content_type}|%{size_download}' "$url")" || out="000||0"
  STATUS="${out%%|*}"; local rest="${out#*|}"; CTYPE="${rest%%|*}"; SIZE="${rest##*|}"
}

fetch /
[[ "$STATUS" == 200 ]] && ok "GET / 200" || { fail "GET / returned $STATUS"; echo "FAILED ($FAILS)"; exit 1; }
HTML="$(tr '\n\r' '  ' < "$TMP/body")"   # flatten so tags that span lines still match

# --- tags (attribute order and line breaks tolerated) ---
meta_content() { # $1 = property/name value
  printf '%s' "$HTML" | grep -oE '<meta[^>]*(property|name)="'"$1"'"[^>]*>' | head -1 | grep -oE 'content="[^"]*"' | head -1 | sed -E 's/^content="(.*)"$/\1/'
}
for k in og:image og:video og:video:secure_url twitter:player; do
  v="$(meta_content "$k")"
  if [[ "$v" =~ ^https://[^/]+/ ]]; then ok "$k = $v"; else fail "meta $k missing or not an absolute https URL (got '$v')"; fi
done
declare -A EXPECT=([og:video:type]=video/mp4 [og:video:width]=1200 [og:video:height]=630 [twitter:card]=player [twitter:player:width]=1200 [twitter:player:height]=630)
for k in "${!EXPECT[@]}"; do
  v="$(meta_content "$k")"
  [[ "$v" == "${EXPECT[$k]}" ]] && ok "$k = $v" || fail "meta $k expected '${EXPECT[$k]}', got '$v'"
done
for k in og:title og:description; do [[ -n "$(meta_content "$k")" ]] && ok "$k present" || fail "meta $k missing"; done

# --- collect referenced assets: from HTML, then from the JS/CSS they pull in ---
declare -A SEEN=()
QUEUE=()
add() {
  local p="$1"
  p="${p#"$BASE"}"; p="${p#https://lindol-one.vercel.app}"
  [[ "$p" == /* && "$p" != //* ]] || return 0
  p="${p%%[?#]*}"; [[ -z "$p" || "$p" == "/" ]] && return 0
  [[ -n "${SEEN[$p]:-}" ]] && return 0
  SEEN[$p]=1; QUEUE+=("$p")
}
while IFS= read -r u; do add "$u"; done < <(printf '%s' "$HTML" | grep -oE '(href|src|content)="[^"]+"' | sed -E 's/^[a-z]+="(.*)"$/\1/')
add /og/preview.mp4; add /og/player.html; add /og/image.png
i=0
while [[ $i -lt ${#QUEUE[@]} ]]; do
  p="${QUEUE[$i]}"; i=$((i + 1))
  fetch "$p"
  want=""
  case "$p" in
    *.js) want='javascript' ;; *.css) want='text/css' ;; *.json) want='json' ;; *.png) want='image/png' ;;
    *.svg) want='image/svg' ;; *.mp4) want='video/mp4' ;; *.html) want='text/html' ;; *.woff2) want='font/woff2|application/font-woff2' ;;
    *.ico) want='icon' ;; *.webp) want='image/webp' ;; *) want='' ;;
  esac
  if [[ "$STATUS" != 200 ]]; then fail "$p returned $STATUS"; continue; fi
  if [[ -n "$want" ]] && ! [[ "$CTYPE" =~ $want ]]; then fail "$p has content-type '$CTYPE', expected $want"; continue; fi
  ok "$p 200 ($CTYPE)"
  if [[ "$p" == *.js || "$p" == *.css ]]; then
    while IFS= read -r ref; do add "$ref"; done < <(grep -oE "[\"'(\`](/[A-Za-z0-9_./-]+\.(js|css|json|png|svg|mp4|html|woff2?|ico|webp|webmanifest))[\"')\`]" "$TMP/body" | sed -E "s/^.(.*).\$/\1/")
  fi
done

# --- the video specifically ---
fetch /og/preview.mp4
[[ "$STATUS" == 200 ]] || fail "/og/preview.mp4 returned $STATUS"
[[ "$CTYPE" == video/mp4* ]] || fail "/og/preview.mp4 content-type is '$CTYPE', expected video/mp4"
if [[ "$SIZE" =~ ^[0-9]+$ && "$SIZE" -gt 0 && "$SIZE" -lt 5242880 ]]; then ok "/og/preview.mp4 is $SIZE bytes (< 5 MB)"; else fail "/og/preview.mp4 size $SIZE bytes is not between 1 and 5 MB"; fi
fetch /og/player.html
[[ "$STATUS" == 200 ]] && ok "/og/player.html 200" || fail "/og/player.html returned $STATUS"

if [[ $FAILS -gt 0 ]]; then echo "LIVE CHECK FAILED: $FAILS problem(s)" >&2; exit 1; fi
echo "LIVE CHECK OK: $BASE (${#QUEUE[@]} assets)"
