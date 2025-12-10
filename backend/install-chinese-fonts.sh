#!/bin/bash
# Install Chinese fonts for text-to-image feature
# Run this script to install fonts that support Traditional Chinese

echo "Installing Chinese font support..."

# For Ubuntu/Debian
if command -v apt-get >/dev/null 2>&1; then
    echo "Installing fonts via apt-get..."
    sudo apt-get update
    sudo apt-get install -y \
        fonts-noto-cjk \
        fonts-wqy-microhei \
        fonts-wqy-zenhei \
        fonts-arphic-uming \
        fonts-arphic-ukai
    
    echo "✅ Chinese fonts installed!"
    echo "Available fonts:"
    echo "  - Noto Sans CJK (Traditional Chinese)"
    echo "  - WenQuanYi Micro Hei"
    echo "  - WenQuanYi Zen Hei"
    echo "  - AR PL UMing"
    echo "  - AR PL UKai"
fi

# For Alpine (Docker)
if command -v apk >/dev/null 2>&1; then
    echo "Installing fonts via apk..."
    apk add --no-cache \
        font-noto-cjk \
        font-wqy-microhei \
        font-wqy-zenhei
    
    echo "✅ Chinese fonts installed!"
fi

echo ""
echo "Font locations:"
echo "  Noto Sans CJK: /usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"
echo "  WQY Micro Hei: /usr/share/fonts/truetype/wqy/wqy-microhei.ttc"
echo "  WQY Zen Hei: /usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
echo "  AR PL UMing: /usr/share/fonts/truetype/arphic/uming.ttc"

