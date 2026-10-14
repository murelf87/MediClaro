@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MediClaro - Comprobacion final
color 0F

echo ============================================================
echo  MEDICLARO - COMPROBACION FINAL
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado o no esta en PATH.
  echo Instala Node.js LTS y vuelve a ejecutar este BAT.
  goto :END_ERROR
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm no esta disponible.
  goto :END_ERROR
)

if not exist node_modules\typescript\package.json (
  echo [INFO] Faltan dependencias del proyecto. Ejecutando npm ci...
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] npm ci ha fallado. Comprueba Internet y vuelve a intentarlo.
    goto :END_ERROR
  )
)

echo.
echo [1/4] Comprobaciones de release...
node scripts\release-check.mjs
if errorlevel 1 goto :END_ERROR

echo.
echo [2/4] TypeScript estricto...
call npm run typecheck
if errorlevel 1 goto :END_ERROR

echo.
echo [3/4] Pruebas unitarias...
call npm test -- --runInBand
if errorlevel 1 goto :END_ERROR

echo.
echo [4/4] Configuracion Expo...
call npx expo config --type introspect > "%TEMP%\mediclaro-expo-config.txt"
if errorlevel 1 goto :END_ERROR

echo.
echo ============================================================
echo  RESULTADO: CODIGO Y TESTS OK
echo ============================================================
echo Esto NO sustituye las pruebas reales de Apple Sandbox, Google
 echo License Testing, SMS, camara, GPS y Gemini con tus cuentas.
echo Revisa PRODUCTION_SETUP.md antes de activar storeVerification.
goto :END_OK

:END_ERROR
echo.
echo ============================================================
echo  RESULTADO: HAY ALGO QUE CORREGIR O CONFIGURAR
echo ============================================================
exit /b 1

:END_OK
pause
exit /b 0
