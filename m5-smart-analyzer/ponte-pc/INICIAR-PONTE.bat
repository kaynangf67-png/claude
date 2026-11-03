@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Ponte MT5 - somente leitura
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo O Node.js nao esta instalado neste computador.
  echo Baixe a versao LTS em https://nodejs.org , instale e abra este arquivo de novo.
  echo.
  pause
  exit /b 1
)
echo ==============================================================
echo  PONTE MT5 -^> APP: somente leitura, so neste computador.
echo  O script M5Exportador precisa estar rodando no MT5.
echo  Deixe esta janela aberta. Para parar: feche a janela.
echo ==============================================================
:loop
node ponte-mt5.cjs %*
if %errorlevel%==2 (
  echo.
  echo Erro de configuracao. Leia a mensagem acima.
  pause
  exit /b 2
)
echo.
echo A ponte parou. Reiniciando em 10 segundos...
timeout /t 10 >nul
goto loop
