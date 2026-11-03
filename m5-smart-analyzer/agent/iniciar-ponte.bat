@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
title Ponte MT5 - somente leitura
echo ==============================================================
echo  PONTE MT5 -^> APP: somente leitura, so neste computador.
echo  O script M5Exportador precisa estar rodando no MT5.
echo  Para parar: feche esta janela ou aperte Ctrl+C.
echo ==============================================================
:loop
call npm run ponte -- %*
if %errorlevel%==2 (
  echo.
  echo Erro de configuracao. Leia a mensagem acima e corrija.
  pause
  exit /b 2
)
echo.
echo A ponte parou. Reiniciando em 10 segundos... ^(feche a janela para parar^)
timeout /t 10 >nul
goto loop
