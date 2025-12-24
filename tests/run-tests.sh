#!/bin/bash

# Cboard 增强项目 - 测试运行脚本
# 用于自动化运行所有测试
# 兼容 WSL2 和 Linux 环境

set -e  # Exit on error

echo "=========================================="
echo "Cboard 增强项目 - 测试套件"
echo "运行环境: $(uname -a)"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Node.js
echo "检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js 版本: $(node --version)${NC}"
echo ""

# 检查 PHP
echo "检查 PHP..."
if ! command -v php &> /dev/null; then
    echo -e "${RED}❌ PHP 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✅ PHP 版本: $(php --version | head -n 1)${NC}"
echo ""

# 检查 MySQL
echo "检查 MySQL..."
if ! command -v mysql &> /dev/null; then
    echo -e "${YELLOW}⚠️  MySQL 客户端未安装（可选）${NC}"
else
    echo -e "${GREEN}✅ MySQL 客户端已安装${NC}"
fi
echo ""

# 检查依赖
echo "检查前端依赖..."
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  前端依赖未安装，正在安装...${NC}"
    npm install
fi
echo -e "${GREEN}✅ 前端依赖已安装${NC}"
echo ""

# 运行测试
echo "=========================================="
echo "开始运行测试..."
echo "=========================================="
echo ""

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 单元测试
echo "1. 运行单元测试..."
if [ -f "package.json" ] && grep -q '"test"' package.json; then
    # Run tests and capture both output and exit code
    TEST_OUTPUT=$(npm test -- --watchAll=false --coverage=false --passWithNoTests 2>&1)
    TEST_EXIT_CODE=$?
    
    # Show last 150 lines of output (to see test results)
    echo "$TEST_OUTPUT" | tail -n 150
    
    # Check for FAIL in output (more reliable than exit code in some cases)
    if echo "$TEST_OUTPUT" | grep -q "FAIL"; then
        echo -e "${RED}❌ 单元测试失败（发现 FAIL 标记）${NC}"
        TEST_EXIT_CODE=1
    elif [ $TEST_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ 单元测试通过${NC}"
    else
        echo -e "${YELLOW}⚠️  单元测试有警告或失败（退出码: $TEST_EXIT_CODE）${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  未找到测试配置，跳过单元测试${NC}"
    TEST_EXIT_CODE=0
fi
echo ""

# API 测试（需要后端运行）
echo "2. 检查后端 API..."
if command -v curl &> /dev/null; then
    if curl -s -f http://localhost:8000/api > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 后端 API 可访问 (http://localhost:8000/api)${NC}"
    else
        echo -e "${YELLOW}⚠️  后端 API 未运行${NC}"
        echo "   提示: 在 WSL2 中运行: cd backend && php -S localhost:8000 -t . router.php"
    fi
else
    echo -e "${YELLOW}⚠️  curl 未安装，跳过 API 检查${NC}"
fi
echo ""

# 数据库测试
# echo "3. 检查数据库连接..."
# if command -v mysql &> /dev/null; then
#     # 尝试连接数据库（需要配置）
#     echo -e "${YELLOW}⚠️  数据库连接测试需要配置数据库凭据${NC}"
#     echo "   提示: 检查 backend/config/config.php 中的数据库配置"
# else
#     echo -e "${YELLOW}⚠️  MySQL 客户端未安装，跳过数据库测试${NC}"
# fi
# echo ""

# 文件结构检查
echo "4. 检查关键文件..."
MISSING_FILES=0

check_file() {
    if [ -f "$1" ]; then
        echo -e "  ${GREEN}✅ $1${NC}"
    else
        echo -e "  ${RED}❌ $1 (缺失)${NC}"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
}

check_file "backend/api/routes/data-retention.php"
check_file "backend/api/routes/ai.php"
check_file "src/components/Settings/DataRetention/DataRetention.component.js"
check_file "src/components/Settings/AIFeatures/AIFeatures.container.js"
check_file "backend/database/migrations/add-data-retention-policy.sql"
check_file "backend/scripts/cleanup-old-logs.php"

if [ $MISSING_FILES -eq 0 ]; then
    echo -e "${GREEN}✅ 所有关键文件存在${NC}"
else
    echo -e "${YELLOW}⚠️  发现 $MISSING_FILES 个缺失文件${NC}"
fi
echo ""

# 总结
echo "=========================================="
echo "测试总结"
echo "=========================================="
echo ""

if [ $TEST_EXIT_CODE -eq 0 ] && [ $MISSING_FILES -eq 0 ]; then
    echo -e "${GREEN}✅ 所有检查通过！${NC}"
    echo ""
    echo "下一步:"
    echo "  1. 确保后端服务器运行: cd backend && php -S localhost:8000 -t . router.php"
    echo "  2. 确保前端服务器运行: npm start"
    echo "  3. 运行数据库迁移: mysql -u root -p cboard < backend/database/migrations/add-data-retention-policy.sql"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠️  部分检查未通过，请查看上述输出${NC}"
    echo ""
    echo "建议:"
    echo "  - 检查缺失的文件"
    echo "  - 查看测试输出中的错误信息"
    echo "  - 确保所有依赖已安装"
    echo ""
    exit 1
fi

