#!/bin/bash
# Verify WebGazer Model Files
# Checks if model files exist and have correct sizes

MODELS_DIR="public/models"

echo "=========================================="
echo " Verifying WebGazer Model Files"
echo "=========================================="
echo ""

declare -a models=(
    "facemesh:model.json:group1-shard1of1.bin:2000000"
    "iris:model.json:group1-shard1of1.bin:1000000"
    "blazeface:model.json:group1-shard1of1.bin:300000"
)

all_valid=true

for model_info in "${models[@]}"; do
    IFS=':' read -r name json_file bin_file expected_size_mb <<< "$model_info"
    model_path="$MODELS_DIR/$name"
    
    echo "[$name]"
    
    if [ ! -d "$model_path" ]; then
        echo "  ✗ Directory not found: $model_path"
        all_valid=false
        continue
    fi
    
    # Check model.json
    json_path="$model_path/$json_file"
    if [ -f "$json_path" ]; then
        size_bytes=$(stat -f%z "$json_path" 2>/dev/null || stat -c%s "$json_path" 2>/dev/null || echo "0")
        size_kb=$((size_bytes / 1024))
        size_mb=$((size_bytes / 1024 / 1024))
        
        if [ "$size_bytes" -lt 10000 ]; then
            echo "  ✗ $json_file - Size: ${size_kb} KB (TOO SMALL - should be ~${expected_size_mb} MB)"
            all_valid=false
        else
            echo "  ✓ $json_file - Size: ${size_mb} MB"
        fi
    else
        echo "  ✗ $json_file - NOT FOUND"
        all_valid=false
    fi
    
    # Check .bin file
    bin_path="$model_path/$bin_file"
    if [ -f "$bin_path" ]; then
        size_bytes=$(stat -f%z "$bin_path" 2>/dev/null || stat -c%s "$bin_path" 2>/dev/null || echo "0")
        size_kb=$((size_bytes / 1024))
        size_mb=$((size_bytes / 1024 / 1024))
        expected_size_mb_display=$((expected_size_mb / 1024 / 1024))
        
        if [ "$size_bytes" -lt "$expected_size_mb" ]; then
            echo "  ✗ $bin_file - Size: ${size_mb} MB (TOO SMALL - should be at least ~${expected_size_mb_display} MB)"
            all_valid=false
        else
            echo "  ✓ $bin_file - Size: ${size_mb} MB"
        fi
    else
        echo "  ✗ $bin_file - NOT FOUND"
        all_valid=false
    fi
    
    echo ""
done

if [ "$all_valid" = true ]; then
    echo "=========================================="
    echo " ✓ All model files are valid!"
    echo "=========================================="
    exit 0
else
    echo "=========================================="
    echo " ✗ Some model files are missing or invalid"
    echo "=========================================="
    echo ""
    echo "Please run the download script:"
    echo "  bash scripts/download-webgazer-models.sh"
    echo ""
    exit 1
fi

