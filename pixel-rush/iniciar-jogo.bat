@echo off
title ESTRESSE - servidor do jogo
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao esta instalado.
  echo  Vou abrir o site: baixe a versao LTS, instale e depois abra este arquivo de novo.
  start https://nodejs.org
  pause
  exit /b
)

node -e "process.exit(Number(process.versions.node.split('.')[0]) < 22 ? 1 : 0)"
if errorlevel 1 (
  echo.
  echo  Seu Node.js e antigo. Instale a versao LTS mais nova em https://nodejs.org
  start https://nodejs.org
  pause
  exit /b
)

if not exist node_modules (
  echo  Instalando o jogo pela primeira vez...
  call npm install
)

echo.
echo  ===========================================
echo   ESTRESSE rodando em http://localhost:3000
echo   NAO FECHE esta janela enquanto estiver jogando.
echo  ===========================================
echo.
start "" http://localhost:3000
call npm start
pause
