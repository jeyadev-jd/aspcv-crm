#!/usr/bin/env bash
# Restore the CRM database from a backup produced by backup.sh.
#
# Usage:  ./scripts/restore.sh backups/aspcv_crm-20260801-020000.sql.gz
#
# THIS OVERWRITES THE TARGET DATABASE. The dump was taken with --clean, so it
# drops existing objects before recreating them. A confirmation prompt guards
# against an accidental run; set RESTORE_YES=1 to skip it in automation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

FILE="${1:-}"
if [ -z "$FILE" ]; then
  echo "Usage: $0 <backup.sql.gz>" >&2
  echo "Available:" >&2
  ls -1t "$BACKEND_DIR/backups"/*.sql.gz 2>/dev/null | head -20 >&2 || echo "  (none)" >&2
  exit 1
fi
if [ ! -f "$FILE" ]; then
  echo "ERROR: no such file: $FILE" >&2
  exit 1
fi
if ! gzip -t "$FILE" 2>/dev/null; then
  echo "ERROR: $FILE fails gzip integrity check - do not restore from it." >&2
  exit 1
fi

PSQL="$(command -v psql || true)"
if [ -z "$PSQL" ]; then
  PSQL="$(ls -1 "/c/Program Files/PostgreSQL"/*/bin/psql.exe 2>/dev/null | sort -V | tail -1 || true)"
fi
if [ -z "$PSQL" ]; then
  echo "ERROR: psql not found." >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$BACKEND_DIR/.env" | cut -d= -f2- | tr -d '"'"'"'')"
fi

TARGET="$(echo "$DATABASE_URL" | sed 's#.*/##; s#?.*##')"
echo "About to OVERWRITE database '$TARGET' with $FILE"
if [ "${RESTORE_YES:-}" != "1" ]; then
  printf "Type the database name to confirm: "
  read -r ANSWER
  if [ "$ANSWER" != "$TARGET" ]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "Restoring..."
gunzip -c "$FILE" | "$PSQL" --dbname="$DATABASE_URL" --quiet --set ON_ERROR_STOP=on
echo "OK: restored from $FILE"
echo "Run 'npx prisma generate' if the schema changed."
