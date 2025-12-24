@echo off
REM Cboard 增强项目 - 测试运行脚本 (Windows)
REM 用于自动化运行所有测试

echo ==========================================
echo Cboard 增强项目 - 测试套件
echo ==========================================
echo.

REM 检查 Node.js
echo 检查 Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] Node.js 未安装
    exit /b 1
)
node --version
echo.

REM 检查 PHP
echo 检查 PHP...
where php >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [警告] PHP 未安装（可选）
) else (
    php --version
)
echo.

REM 检查依赖
echo 检查前端依赖...
if not exist "node_modules" (
    echo [警告] 前端依赖未安装，正在安装...
    call npm install
)
echo [成功] 前端依赖已安装
echo.

REM 运行测试
echo ==========================================
echo 开始运行测试...
echo ==========================================
echo.

REM 单元测试
echo 1. 运行单元测试...
call npm test -- --watchAll=false --coverage=false
if %ERRORLEVEL% EQU 0 (
    echo [成功] 单元测试通过
) else (
    echo [错误] 单元测试失败
)
echo.

REM API 测试（需要后端运行）
echo 2. 检查后端 API...
curl -s http://localhost:8000/api >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [成功] 后端 API 可访问
) else (
    echo [警告] 后端 API 未运行（请先启动后端服务器）
)
echo.

REM 总结
echo ==========================================
echo 测试总结
echo ==========================================
echo.
echo 测试完成！请查看上述输出了解详细结果。
pause

