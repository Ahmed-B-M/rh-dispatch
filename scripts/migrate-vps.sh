#!/bin/bash
# migrate-vps.sh — Applique les migrations Prisma et seed sur le VPS
# Usage: bash scripts/migrate-vps.sh

set -e

echo "=== rh-dispatch — Migration VPS ==="
echo ""

SSH="ssh -i ~/.ssh/id_ed25519_nopw root@72.60.213.4"

echo "1. Statut migrations avant..."
$SSH "docker exec supabase-db psql -U postgres -d rh_dispatch -c 'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;' 2>/dev/null || echo '(table _prisma_migrations absente — premiere migration)'"

echo ""
echo "2. Application des migrations via service migrator..."
$SSH "cd /root/rh-dispatch && docker compose -f docker-compose.prod.yml run --rm migrator"

echo ""
echo "3. Seed PQS criteria (idempotent)..."
$SSH "docker exec rh-dispatch npm run seed"

echo ""
echo "4. Statut migrations apres..."
$SSH "docker exec supabase-db psql -U postgres -d rh_dispatch -c 'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;'"

echo ""
echo "=== Termine ==="
