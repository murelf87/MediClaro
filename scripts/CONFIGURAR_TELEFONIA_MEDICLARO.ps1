$ErrorActionPreference = 'Stop'
$project = 'ldonnvkysjalpmystoeq'
Write-Host '=== MediClaro - Configurar telefonia automatica ===' -ForegroundColor Cyan
Write-Host 'Los datos se introducen SOLO en este PC y no se muestran en ChatGPT.'
$sid = Read-Host 'Twilio Account SID (empieza por AC)'
$tokenSecure = Read-Host 'Twilio Auth Token' -AsSecureString
$from = Read-Host 'Numero Twilio con Voice + SMS (formato +34...)'
if (-not $sid.StartsWith('AC')) { throw 'El Account SID no parece valido.' }
if (-not $from.StartsWith('+')) { throw 'El numero debe estar en formato internacional, por ejemplo +34...' }
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenSecure)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  Set-Location 'C:\Users\ANTONIO\MediClaro_FINAL_2026-09-29\mediclaro'
  & npx supabase secrets set "TWILIO_ACCOUNT_SID=$sid" "TWILIO_AUTH_TOKEN=$token" "TWILIO_FROM_NUMBER=$from" --project-ref $project
  if ($LASTEXITCODE -ne 0) { throw 'Supabase no ha aceptado las credenciales.' }
  Write-Host 'TELEFONIA_MEDICLARO=CONFIGURADA' -ForegroundColor Green
} finally {
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  $token = $null
}