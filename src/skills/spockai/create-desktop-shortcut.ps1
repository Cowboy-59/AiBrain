# Create SpockAI Desktop Shortcut

$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "SpockAI.lnk"

$shortcut = $ws.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "E:\AI_Development\AJBrain\src\skills\spockai\start-spockai.bat"
$shortcut.WorkingDirectory = "E:\AI_Development\AJBrain\src\skills\spockai\tray"
$shortcut.WindowStyle = 7  # Minimized
$shortcut.Description = "SpockAI Personal Assistant"
$shortcut.Save()

Write-Host "Desktop shortcut created at: $shortcutPath"
