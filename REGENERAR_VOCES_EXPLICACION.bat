@echo off
setlocal
title MediClaro - Regenerar las voces de "Conocer MediClaro"
cd /d "%~dp0"

echo.
echo ==============================================================
echo   MediClaro - regenerar las voces de la explicacion inicial
echo ==============================================================
echo.
echo   La explicacion es UNA sola grabacion con UNA sola voz (Sulafat).
echo   Si la actual esta cortada (o si escribes --todas), pide a Google
echo   Gemini el texto entero de una vez, comprueba que este entero y
echo   monta de nuevo la explicacion. Necesita internet y tener ya
echo   desplegada la funcion tts-preview del 09/10/2026.
echo   Si no sale bien, la grabacion actual no se toca.
echo.

where node >nul 2>nul
if errorlevel 1 goto :nonode

if exist "node_modules\expo\package.json" goto :run
echo Instalando lo necesario. Solo la primera vez, tarda unos minutos...
call npm ci --no-audit --no-fund
if errorlevel 1 goto :fail

:run
rem Valores PUBLICOS (los mismos de eas.json). Ningun secreto.
if not defined EXPO_PUBLIC_SUPABASE_URL set "EXPO_PUBLIC_SUPABASE_URL=https://ldonnvkysjalpmystoeq.supabase.co"
if not defined EXPO_PUBLIC_SUPABASE_ANON_KEY set "EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_tW0nl1oGYmnIW9BrFTpJSw_-xuEIuZf"

call node scripts\generate-tour-consistent-rc.mjs %*
if errorlevel 1 goto :fail
call npx jest --config jest.config.js src/config/__tests__/tourTimeline.test.ts
if errorlevel 1 goto :fail

echo.
echo   Listo: la explicacion ya usa la voz nueva. Escuchala antes de publicar.
echo   Vuelve a abrir la app (VER_EN_IPHONE_EXPO_GO.bat) para oirlas.
echo.
pause
exit /b 0

:nonode
echo.
echo   Falta Node.js. Instalalo desde https://nodejs.org (version LTS) y vuelve a abrir este archivo.
echo.
pause
exit /b 1

:fail
echo.
echo   No se ha completado. Las grabaciones anteriores siguen igual.
echo   Revisa la conexion a internet y vuelve a intentarlo en unos minutos.
echo.
pause
exit /b 1
