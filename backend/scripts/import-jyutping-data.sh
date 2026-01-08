#!/bin/bash

#
# Jyutping Dictionary Import Script
# 
# Imports and dedupes Jyutping data from 3 CSV sources into the cboard database.
# 
# Usage (from project root):
#   bash backend/scripts/import-jyutping-data.sh [OPTIONS]
#
# Options:
#   --truncate          Clear jyutping_dictionary before import (fresh start)
#   --verify            Show row count after import
#   --backup            Backup jyutping_dictionary before import (default: no backup)
#   --help              Show this message
#
# Examples:
#   # Standard import (upsert, no truncate)
#   bash backend/scripts/import-jyutping-data.sh
#
#   # Clean rebuild with verification
#   bash backend/scripts/import-jyutping-data.sh --truncate --verify
#
#   # Backup before import
#   bash backend/scripts/import-jyutping-data.sh --backup --verify
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
IMPORTER="$SCRIPT_DIR/seed-jyutping-from-multiple-csv.php"
ENV_FILE="$PROJECT_ROOT/backend/.env"

TRUNCATE=0
VERIFY=0
BACKUP=0

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function print_help() {
    grep "^#" "$0" | tail -n +2 | sed 's/^# *//'
}

function print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

function print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

function print_error() {
    echo -e "${RED}✗${NC} $1" >&2
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --truncate)
            TRUNCATE=1
            shift
            ;;
        --verify)
            VERIFY=1
            shift
            ;;
        --backup)
            BACKUP=1
            shift
            ;;
        --help)
            print_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            print_help
            exit 1
            ;;
    esac
done

# Verify files exist
if [ ! -f "$IMPORTER" ]; then
    print_error "Importer script not found: $IMPORTER"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    print_error ".env file not found: $ENV_FILE"
    exit 1
fi

print_info "Jyutping Dictionary Import Tool"
print_info "Project root: $PROJECT_ROOT"

# Load environment
# Safe .env parser that handles quotes and special characters (no xargs)
if [ -f "$ENV_FILE" ]; then
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue
        
        # Trim leading/trailing whitespace (bash only, no xargs)
        key="${key#"${key%%[![:space:]]*}"}"
        key="${key%"${key##*[![:space:]]}"}"
        value="${value#"${value%%[![:space:]]*}"}"
        value="${value%"${value##*[![:space:]]}"}"
        
        # Remove surrounding quotes if present
        value="${value#\"}"
        value="${value%\"}"
        value="${value#\'}"
        value="${value%\'}"
        
        # Export variable
        export "$key=$value"
    done < "$ENV_FILE"
fi

if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    print_error "Missing database credentials in .env file"
    exit 1
fi

print_info "Database: $DB_NAME @ $DB_HOST (user: $DB_USER)"

# Test database connection
print_info "Testing database connection..."
if ! mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1;" &>/dev/null; then
    print_error "Cannot connect to database. Check:"
    print_error "  - Server is reachable: ping $DB_HOST"
    print_error "  - Credentials are correct in .env"
    print_error "  - Firewall allows port 3306"
    exit 1
fi
print_success "Database connection OK"

# Optional backup
if [ $BACKUP -eq 1 ]; then
    print_info "Creating backup..."
    BACKUP_FILE="$PROJECT_ROOT/backend/database/backups/jyutping_dictionary_$(date +%Y%m%d_%H%M%S).sql"
    mkdir -p "$(dirname "$BACKUP_FILE")"
    
    mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
        -e "SELECT * FROM jyutping_dictionary;" > "$BACKUP_FILE" 2>/dev/null || true
    
    print_success "Backup saved: $BACKUP_FILE"
fi

# Build importer command
CMD="php $IMPORTER"
if [ $TRUNCATE -eq 1 ]; then
    print_info "Truncate flag set: will clear table before import"
    CMD="$CMD --truncate"
fi

print_info ""
print_info "Running Jyutping importer..."
print_info "CSVs: jyutping_cc-canto.csv, jyutping_pycantonese_input.csv, jyutping_pycantonese_input_from_boards.csv"
print_info ""

# Run importer
cd "$PROJECT_ROOT"
$CMD

# Verify results
if [ $VERIFY -eq 1 ]; then
    print_info ""
    print_info "Verification..."
    COUNT=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e "SELECT COUNT(*) FROM jyutping_dictionary;")
    print_success "Total entries in jyutping_dictionary: $COUNT"
fi

print_success "Import completed!"
