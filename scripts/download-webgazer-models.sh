#!/bin/bash

# Download WebGazer TensorFlow.js Models for Self-Hosting
# This script downloads the required models from TensorFlow Hub and saves them locally
# to avoid CORS issues when loading from external URLs

set -e

MODELS_DIR="public/models"
FACEMESH_DIR="${MODELS_DIR}/facemesh"
IRIS_DIR="${MODELS_DIR}/iris"
BLAZEFACE_DIR="${MODELS_DIR}/blazeface"

# Create directories
mkdir -p "${FACEMESH_DIR}"
mkdir -p "${IRIS_DIR}"
mkdir -p "${BLAZEFACE_DIR}"

echo "=========================================="
echo " Downloading WebGazer TensorFlow Models"
echo "=========================================="
echo ""

# Function to download a file
download_file() {
    local url=$1
    local output=$2
    echo "Downloading: $url"
    echo "  -> $output"
    
    if command -v curl &> /dev/null; then
        curl -L -o "$output" "$url"
    elif command -v wget &> /dev/null; then
        wget -O "$output" "$url"
    else
        echo "Error: Neither curl nor wget is available"
        exit 1
    fi
    
    if [ -f "$output" ]; then
        echo "  ✓ Downloaded successfully"
    else
        echo "  ✗ Download failed"
        exit 1
    fi
    echo ""
}

# Download Facemesh model
echo "[1/3] Downloading Facemesh model..."
FACEMESH_BASE="https://tfhub.dev/mediapipe/tfjs-model/facemesh/1/default/1"
download_file "${FACEMESH_BASE}/model.json" "${FACEMESH_DIR}/model.json"
download_file "${FACEMESH_BASE}/group1-shard1of1.bin" "${FACEMESH_DIR}/group1-shard1of1.bin"

# Download Iris model
echo "[2/3] Downloading Iris model..."
IRIS_BASE="https://tfhub.dev/mediapipe/tfjs-model/iris/1/default/2"
download_file "${IRIS_BASE}/model.json" "${IRIS_DIR}/model.json"
download_file "${IRIS_BASE}/group1-shard1of1.bin" "${IRIS_DIR}/group1-shard1of1.bin"

# Download Blazeface model (used by face-landmarks-detection)
echo "[3/3] Downloading Blazeface model..."
BLAZEFACE_BASE="https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1"
download_file "${BLAZEFACE_BASE}/model.json" "${BLAZEFACE_DIR}/model.json"
download_file "${BLAZEFACE_BASE}/group1-shard1of1.bin" "${BLAZEFACE_DIR}/group1-shard1of1.bin"

echo "=========================================="
echo " ✓ All models downloaded successfully!"
echo "=========================================="
echo ""
echo "Models are now available at:"
echo "  - ${FACEMESH_DIR}/"
echo "  - ${IRIS_DIR}/"
echo "  - ${BLAZEFACE_DIR}/"
echo ""
echo "Next steps:"
echo "  1. Update WebGazer initialization to use local model URLs"
echo "  2. Restart the development server"
echo ""

