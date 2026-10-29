#!/usr/bin/env bash
#
# Smoke test da aplicação em contentores, sempre através do nginx (como um browser).
# Usado na CI depois de `docker compose --profile app up --wait`; também corre localmente:
#
#   tools/smoke-test.sh                     # http://localhost:8080
#   tools/smoke-test.sh https://o-teu-dominio
#
set -euo pipefail

BASE="${1:-http://localhost:8080}"
API="$BASE/api/v1"
failures=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ok    $name"
  else
    echo "  FALHA $name (esperado: $expected, obtido: $actual)"
    failures=$((failures + 1))
  fi
}

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "Smoke test em $BASE"

# Frontend
check "index.html servido" 200 "$(status "$BASE/")"
check "rota do Angular cai no index.html" 200 "$(status "$BASE/applications")"
check "contém a aplicação Angular" 1 "$(curl -s "$BASE/" | grep -c '<ds-root')"

headers="$(curl -s -D - -o /dev/null "$BASE/")"
check "CSP presente" 1 "$(grep -ci '^content-security-policy:' <<<"$headers")"
check "X-Frame-Options presente" 1 "$(grep -ci '^x-frame-options: DENY' <<<"$headers")"

# API através do nginx → gateway → serviços
check "catálogo público (profile-service)" 200 "$(status "$API/stacks")"
check "rota protegida sem token" 401 "$(status "$API/profile")"

email="smoke-$(date +%s)-$RANDOM@example.com"
register="$(curl -s -X POST "$API/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$email\",\"password\":\"smoke-test-1234\",\"fullName\":\"Smoke Test\"}")"
token="$(jq -r '.accessToken // empty' <<<"$register")"
check "registo devolve access token (auth-service)" 1 "$([[ -n "$token" ]] && echo 1 || echo 0)"

auth=(-H "Authorization: Bearer $token")
check "perfil com token (profile-service)" 200 "$(status "${auth[@]}" "$API/profile")"
check "quadro de candidaturas (tracker-service)" 200 "$(status "${auth[@]}" "$API/applications")"

# Limpa: apaga a conta (e, por evento, os dados nos outros serviços).
check "eliminação da conta" 204 "$(status -X DELETE "${auth[@]}" \
  -H 'Content-Type: application/json' -d '{"password":"smoke-test-1234"}' "$API/auth/me")"
check "token revogado depois de apagar a conta" 401 "$(status "${auth[@]}" "$API/profile")"

# Conta de demonstração: o auth-service cria-a e os outros serviços preenchem-na
# por evento (user.demo-created). Espera até 10 s pelos dados de exemplo.
demo_response="$(curl -s -w '\n%{http_code}' -X POST "$API/auth/demo")"
check "conta de demonstração criada" 201 "$(tail -n1 <<<"$demo_response")"
demo_token="$(head -n -1 <<<"$demo_response" | jq -r '.accessToken // empty' 2>/dev/null || true)"
demo=(-H "Authorization: Bearer $demo_token")
competencies=0 applications=0
for _ in $(seq 1 20); do
  competencies="$(curl -s "${demo[@]}" "$API/profile" | jq '(.competencies // []) | length' 2>/dev/null || echo 0)"
  applications="$(curl -s "${demo[@]}" "$API/applications/stats" | jq '.total // 0' 2>/dev/null || echo 0)"
  ((competencies > 0 && applications > 0)) && break
  sleep 0.5
done
check "demonstração preenchida pelo profile-service (evento)" 1 "$((competencies > 0 ? 1 : 0))"
check "demonstração preenchida pelo tracker-service (evento)" 1 "$((applications > 0 ? 1 : 0))"
check "demonstração termina sem password" 204 "$(status -X DELETE "${demo[@]}" \
  -H 'Content-Type: application/json' -d '{}' "$API/auth/me")"

if ((failures)); then
  echo "$failures verificação(ões) falharam."
  exit 1
fi
echo "Tudo OK."
