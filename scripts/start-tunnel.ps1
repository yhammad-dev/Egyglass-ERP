# EgyGlass ERP — Cloudflare Tunnel Auto-Start
# Kills any existing tunnel, starts a new one, writes URL to Desktop

$logFile  = "$env:TEMP\egyglass_tunnel.log"
$urlFile  = "$env:USERPROFILE\Desktop\EgyGlass-URL.txt"

# Kill any existing cloudflared
Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start cloudflared and capture stderr (URL appears there)
$errLog = "$env:TEMP\egyglass_tunnel_err.log"
Remove-Item $errLog -ErrorAction SilentlyContinue

$proc = Start-Process -FilePath "cloudflared" `
    -ArgumentList "tunnel --url http://localhost:3100" `
    -RedirectStandardError $errLog `
    -NoNewWindow -PassThru

# Wait up to 20s for URL to appear
$url = $null
$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline -and -not $url) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $errLog) {
        $line = Get-Content $errLog -Raw
        if ($line -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
            $url = $Matches[0]
        }
    }
}

if ($url) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $content = "EgyGlass ERP — Public URL`n$url`n`nStarted: $timestamp`nPID: $($proc.Id)"
    Set-Content -Path $urlFile -Value $content -Encoding UTF8

    # Windows toast notification
    Add-Type -AssemblyName System.Windows.Forms
    $notify = New-Object System.Windows.Forms.NotifyIcon
    $notify.Icon = [System.Drawing.SystemIcons]::Information
    $notify.Visible = $true
    $notify.ShowBalloonTip(8000, "EgyGlass ERP", $url, [System.Windows.Forms.ToolTipIcon]::Info)
    Start-Sleep -Seconds 3
    $notify.Dispose()
} else {
    "Failed to get URL at $(Get-Date)" | Out-File $logFile -Append
}
