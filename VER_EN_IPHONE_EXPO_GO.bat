@echo off
setlocal
title MediClaro - Vista previa en iPhone con Expo Go
cd /d "%~dp0"

echo.
echo ==============================================================
echo   MediClaro - vista previa en tu iPhone con Expo Go
echo ==============================================================
echo.
echo   1. En el iPhone instala o actualiza "Expo Go" desde la App Store.
echo   2. Espera a que aparezca un codigo QR en esta ventana.
echo   3. Abre la Camara del iPhone, apunta al QR y toca "Abrir en Expo Go".
echo.
echo   Deja esta ventana abierta mientras usas la app en el iPhone.
echo   Para cerrar: pulsa Ctrl+C en esta ventana.
echo.

where node >nul 2>nul
if errorlevel 1 goto :nonode

if exist "node_modules\expo\package.json" goto :run
echo Instalando lo necesario. Solo la primera vez, tarda unos minutos...
call npm ci --no-audit --no-fund
if errorlevel 1 goto :installfail

:run
rem Valores PUBLICOS (los mismos de eas.json). Ningun secreto.
set "EXPO_PUBLIC_SUPABASE_URL=https://ldonnvkysjalpmystoeq.supabase.co"
set "EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_tW0nl1oGYmnIW9BrFTpJSw_-xuEIuZf"
rem Perfiles de revision internos visibles; compras solo por la tienda (en Expo Go no se cobra nada).
set "EXPO_PUBLIC_DEMO_ACCESS=on"
set "EXPO_PUBLIC_PAYMENTS_MODE=store"
rem Si tienes tu archivo .env con EXPO_PUBLIC_QA_ACCESS_TOKEN, copialo en esta carpeta: Expo lo lee solo.

echo Abriendo MediClaro con tunel: funciona aunque el iPhone use datos moviles...
call npx expo start --go --tunnel --clear
if not errorlevel 1 goto :end

echo.
echo El tunel no ha funcionado. Probando por la WiFi de casa.
echo IMPORTANTE: el iPhone tiene que estar en la MISMA WiFi que este ordenador.
call npx expo start --go --lan --clear
goto :end

:nonode
echo Falta Node.js en este ordenador.
echo Descargalo de https://nodejs.org (version LTS), instalalo y vuelve a abrir este archivo.
goto :end

:installfail
echo No se ha podido instalar. Comprueba la conexion a internet y vuelve a abrir este archivo.

:end
echo.
pause
endlocal
