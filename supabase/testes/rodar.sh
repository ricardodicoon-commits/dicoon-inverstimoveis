#!/usr/bin/env bash
# Testes dos scripts da Secretária (05, 06, 07) num banco DESCARTÁVEL — nunca no Supabase.
# Requer o Postgres do JARVIS rodando no Docker do Ubuntu (contêiner jarvis-postgres-1).
# Uso, dentro do Ubuntu:  bash supabase/testes/rodar.sh
# stub-supabase.sql imita o mínimo do Supabase (auth.uid, papéis, regras atuais de leads/negociações).
# Os testes usam só dados fictícios com "TESTE" no nome; o banco de teste é apagado no fim.
set -uo pipefail
T="$(cd "$(dirname "$0")" && pwd)"
S="$(dirname "$T")"
P() { docker exec -i jarvis-postgres-1 psql -U jarvis -q "$@"; }
preparar() {
  P -d jarvis -c 'drop database if exists teste_secretaria' -c 'create database teste_secretaria' >/dev/null 2>&1
  P -d teste_secretaria -v ON_ERROR_STOP=1 < "$T/stub-supabase.sql" >/dev/null 2>&1 || { echo "FALHA no stub"; exit 1; }
  for f in "$@"; do
    P -d teste_secretaria -v ON_ERROR_STOP=1 < "$S/$f.sql" >/dev/null 2>&1 || { echo "FALHA ao aplicar $f"; exit 1; }
  done
}
echo "=== 05";            preparar 05-secretaria-estrutura; P -d teste_secretaria < "$T/teste-05.sql" 2>&1 | grep -v '^CONTEXT'
echo "=== 06 (sobre 05+06+07)"; preparar 05-secretaria-estrutura 06-secretaria-agenda 07-lembretes-e-follow-up; P -d teste_secretaria < "$T/teste-06.sql" 2>&1 | grep -v '^CONTEXT'
echo "=== 07 (sobre 05+06+07)"; preparar 05-secretaria-estrutura 06-secretaria-agenda 07-lembretes-e-follow-up; P -d teste_secretaria < "$T/teste-07.sql" 2>&1 | grep -v '^CONTEXT'
echo "=== rodar duas vezes e desfazer"
preparar 05-secretaria-estrutura 06-secretaria-agenda 07-lembretes-e-follow-up
for f in 05-secretaria-estrutura 06-secretaria-agenda 07-lembretes-e-follow-up; do
  P -d teste_secretaria -v ON_ERROR_STOP=1 < "$S/$f.sql" >/dev/null 2>&1 && echo "OK 2a vez: $f" || echo "FALHA 2a vez: $f"
done
for f in 07-lembretes-e-follow-up-desfazer 06-secretaria-agenda-desfazer 05-secretaria-desfazer; do
  P -d teste_secretaria -v ON_ERROR_STOP=1 < "$S/$f.sql" >/dev/null 2>&1 && echo "OK $f" || echo "FALHA $f"
done
P -d jarvis -c 'drop database teste_secretaria' >/dev/null && echo "BANCO DE TESTE APAGADO"
