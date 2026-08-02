#!/usr/bin/env bash
# Dump the CRM database to a dated, gzipped .sql file and prune old copies.
#
# Usage:  ./scripts/backup.sh [label]
#   label - optional suffix, e.g. "pre-migration". Labelled backups are kept
#           forever; only the automatic daily/weekly ones are pruned.
#
# Reads DATABASE_URL from backend/.env. Exits non-zero on any failure so a
# scheduler can detect a broken backup rather than silently recording success.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$BACKEND_DIR/backups}"
LABEL="${1:-}"

# Windows installs pg_dump outside PATH; fall back to the standard location.
PG_DUMP="$(command -v pg_dump || true)"
if [ -z "$PG_DUMP" ]; then
  PG_DUMP="$(ls -1 "/c/Program Files/PostgreSQL"/*/bin/pg_dump.exe 2>/dev/null | sort -V | tail -1 || true)"
fi
if [ -z "$PG_DUMP" ]; then
  echo "ERROR: pg_dump not found. Install PostgreSQL client tools or set PATH." >&2
  exit 1
fi

# DATABASE_URL may contain '=' and quotes; take everything after the first '='.
if [ -z "${DATABASE_URL:-}" ]; then
  if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "ERROR: no DATABASE_URL in environment and no $BACKEND_DIR/.env" >&2
    exit 1
  fi
  DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$BACKEND_DIR/.env" | cut -d= -f2- | tr -d '"'"'"'')"
fi
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is empty." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
if [ -n "$LABEL" ]; then
  OUT="$BACKUP_DIR/aspcv_crm-$STAMP-$LABEL.sql.gz"
else
  OUT="$BACKUP_DIR/aspcv_crm-$STAMP.sql.gz"
fi
TMP="$OUT.partial"

echo "Backing up to $OUT"

# --clean --if-exists makes the dump restorable over an existing database.
# Write to .partial first so an interrupted dump is never mistaken for a good
# backup by the retention pass below.
if ! "$PG_DUMP" --dbname="$DATABASE_URL" --clean --if-exists --no-owner --no-privileges 2>"$TMP.err" | gzip -9 > "$TMP"; then
  echo "ERROR: pg_dump failed:" >&2
  cat "$TMP.err" >&2
  rm -f "$TMP" "$TMP.err"
  exit 1
fi
rm -f "$TMP.err"

# A valid gzipped dump is never this small; catches silent truncation.
SIZE=$(wc -c < "$TMP")
if [ "$SIZE" -lt 1024 ]; then
  echo "ERROR: dump is only ${SIZE} bytes - refusing to keep it." >&2
  rm -f "$TMP"
  exit 1
fi

if ! gzip -t "$TMP" 2>/dev/null; then
  echo "ERROR: dump failed gzip integrity check." >&2
  rm -f "$TMP"
  exit 1
fi

mv "$TMP" "$OUT"
echo "OK: $(du -h "$OUT" | cut -f1) written"

# ---- Retention -------------------------------------------------------------
# Keep the newest 7 unlabelled dumps, plus one per week for the last 4 weeks.
# Labelled dumps (pre-migration snapshots) are never pruned automatically.
cd "$BACKUP_DIR"
mapfile -t DAILY < <(ls -1t aspcv_crm-*.sql.gz 2>/dev/null | grep -E 'aspcv_crm-[0-9]{8}-[0-9]{6}\.sql\.gz$' || true)

KEEP_FILE="$(mktemp)"
trap 'rm -f "$KEEP_FILE"' EXIT

# Newest 7 always survive.
printf '%s\n' "${DAILY[@]:0:7}" >> "$KEEP_FILE"

# Then the newest dump from each of the last 4 distinct ISO weeks.
SEEN_WEEKS=""
for f in "${DAILY[@]}"; do
  d="${f#aspcv_crm-}"; d="${d%%-*}"
  week="$(date -d "${d:0:4}-${d:4:2}-${d:6:2}" +%G-%V 2>/dev/null || echo "")"
  [ -z "$week" ] && continue
  case " $SEEN_WEEKS " in *" $week "*) continue ;; esac
  SEEN_WEEKS="$SEEN_WEEKS $week"
  echo "$f" >> "$KEEP_FILE"
  [ "$(echo "$SEEN_WEEKS" | wc -w)" -ge 4 ] && break
done

PRUNED=0
for f in "${DAILY[@]}"; do
  if ! grep -qxF "$f" "$KEEP_FILE"; then
    rm -f "$f"
    PRUNED=$((PRUNED + 1))
  fi
done
[ "$PRUNED" -gt 0 ] && echo "Pruned $PRUNED old backup(s)."

exit 0
