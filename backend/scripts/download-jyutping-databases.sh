#!/bin/bash
# Script to download and prepare open-source Jyutping databases
# Usage: bash backend/scripts/download-jyutping-databases.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="$PROJECT_ROOT/backend/database/jyutping-sources"

echo "=== Jyutping Database Download Script ==="
echo ""

# Create data directory
mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

echo "Available open-source Jyutping databases:"
echo ""
echo "1. Jyut Dictionary (GitHub)"
echo "   - Repository: https://github.com/aaronhktan/jyut-dict"
echo "   - Data: 300,000+ entries"
echo "   - License: Open source"
echo ""
echo "2. CC-CANTO"
echo "   - Based on CC-CEDICT"
echo "   - Format: Text/CSV"
echo "   - License: CC-BY-SA"
echo ""
echo "3. pycantonese"
echo "   - Python library with built-in data"
echo "   - GitHub: https://github.com/jacksonllee/pycantonese"
echo ""

echo "To download Jyut Dictionary:"
echo "  1. Visit: https://github.com/aaronhktan/jyut-dict"
echo "  2. Clone the repository:"
echo "     git clone https://github.com/aaronhktan/jyut-dict.git"
echo "  3. Extract data files from the repository"
echo ""

echo "To use pycantonese:"
echo "  1. Install: pip install pycantonese"
echo "  2. Use the generate-jyutping-from-pycantonese.py script"
echo ""

echo "Data directory: $DATA_DIR"
echo ""
echo "After downloading data, convert to CSV format and use:"
echo "  php backend/scripts/seed-jyutping-from-csv.php"
echo ""

