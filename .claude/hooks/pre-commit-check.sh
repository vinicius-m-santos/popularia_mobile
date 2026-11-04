#!/usr/bin/env bash
#
# Gate rápido antes de qualquer `git commit` feito pelo Claude Code.
#
# Roda ESLint e TypeScript. O Jest completo e o Playwright rodam no CI e no
# workflow de fix (claude-fix.yml), onde o custo de esperar não trava o fluxo
# local. Se o comando não for um commit, o hook não faz nada.

set -uo pipefail

payload="$(cat)"

command="$(printf '%s' "$payload" | node -e '
let raw = "";
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(raw);
    process.stdout.write(event?.tool_input?.command ?? "");
  } catch {
    process.stdout.write("");
  }
});
' 2>/dev/null || true)"

case "$command" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 2

if [ ! -d node_modules ]; then
  echo "✖ node_modules ausente. Rode 'npm ci' antes de commitar." >&2
  exit 2
fi

run_check() {
  local label="$1"
  shift
  echo "▶ $label" >&2
  if ! "$@"; then
    echo "✖ $label falhou. Corrija e rode novamente antes de commitar." >&2
    exit 2
  fi
}

run_check "ESLint (npm run lint)" npm run lint
run_check "TypeScript (npm run typecheck)" npm run typecheck

exit 0
