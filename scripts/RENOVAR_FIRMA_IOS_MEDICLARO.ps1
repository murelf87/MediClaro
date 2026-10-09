$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\ANTONIO\MediClaro_FINAL_2026-09-29\mediclaro'
$Host.UI.RawUI.WindowTitle = 'MediClaro - renovar firma Apple y generar actualizacion'
Write-Host 'La build 22 fallo: el perfil Apple no permite notificaciones push.' -ForegroundColor Yellow
Write-Host 'Expo necesita iniciar sesion en Apple para actualizar permisos y firma.'
Write-Host 'Introduce tu contrasena y codigo Apple solo en esta ventana, nunca en el chat.'
Write-Host 'Acepta iniciar sesion en Apple y actualizar el perfil de MediClaro.'
Write-Host 'No elimines certificados de otras aplicaciones.'
npx eas-cli build --platform ios --profile preview --no-wait
if ($LASTEXITCODE -ne 0) {
 Write-Host 'El proceso no ha terminado. Indica en el chat el mensaje de error, sin contrasenas.' -ForegroundColor Yellow
} else {
 Write-Host 'La nueva build se ha enviado. El enlace de Expo aparece arriba.' -ForegroundColor Green
}
