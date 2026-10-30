@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
title Agente de simulacao M5 - dinheiro de mentira
echo ==============================================================
echo  AGENTE DE SIMULACAO: nao envia ordens, nao usa chaves.
echo  Dados da Binance (cripto), NAO sao os precos da Quotex.
echo  Para parar: feche esta janela ou aperte Ctrl+C.
echo ==============================================================
:loop
call npm run agente -- --exploratorio %*
if %errorlevel%==2 (
  echo.
  echo Erro de configuracao. Leia a mensagem acima e corrija.
  pause
  exit /b 2
)
echo.
echo O agente parou. Reiniciando em 15 segundos... ^(feche a janela para parar^)
timeout /t 15 >nul
goto loop
