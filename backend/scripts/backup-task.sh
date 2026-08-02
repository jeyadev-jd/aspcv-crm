#!/usr/bin/env bash
# Wrapper invoked by the Windows Scheduled Task "ASPCV-CRM-Backup".
#
# Exists so the scheduled command line needs no nested quoting - schtasks
# mangles inner quotes, which silently breaks paths containing spaces.
# Resolves its own location, so it works regardless of the task's start dir.

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_DIR" || exit 1

mkdir -p backups
{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') scheduled backup ==="
  bash scripts/backup.sh
  echo "=== exit $? ==="
} >> backups/backup.log 2>&1
