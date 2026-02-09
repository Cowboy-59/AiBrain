# SpockAI Auto-Start Setup Script
# Creates a shortcut in Windows Startup folder

$ws = New-Object -ComObject WScript.Shell
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup "SpockAI.lnk"

$shortcut = $ws.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "E:\AI_Development\AJBrain\src\skills\spockai\start-spockai.bat"
$shortcut.WorkingDirectory = "E:\AI_Development\AJBrain"
$shortcut.WindowStyle = 7  # Minimized
$shortcut.Description = "SpockAI Personal Assistant"
$shortcut.Save()

Write-Host "SpockAI startup shortcut created at: $shortcutPath"
Write-Host "SpockAI will now auto-start when you log in (minimized)"
