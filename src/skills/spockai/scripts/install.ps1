# SpockAI Installation Script for Windows
# Creates a Windows Task Scheduler task for SpockAI

param(
    [string]$Action = "install",
    [string]$TaskName = "SpockAI",
    [string]$NodePath = "",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Find Node.js
function Find-NodeJs {
    if ($NodePath -and (Test-Path $NodePath)) {
        return $NodePath
    }

    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        return $node.Source
    }

    $commonPaths = @(
        "$env:PROGRAMFILES\nodejs\node.exe",
        "$env:PROGRAMFILES(x86)\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
        "$env:USERPROFILE\.nvm\current\node.exe"
    )

    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            return $path
        }
    }

    return $null
}

# Get SpockAI path
function Get-SpockAiPath {
    $skillsPath = Join-Path $env:USERPROFILE ".spockai\skills\spockai"
    if (Test-Path $skillsPath) {
        return $skillsPath
    }

    # Try current directory
    $currentPath = Join-Path $PSScriptRoot ".."
    if (Test-Path (Join-Path $currentPath "package.json")) {
        return $currentPath
    }

    return $null
}

function Install-SpockAI {
    Write-Host "Installing SpockAI as Windows service..." -ForegroundColor Cyan

    # Find Node.js
    $node = Find-NodeJs
    if (-not $node) {
        Write-Host "ERROR: Node.js not found. Please install Node.js 22 or later." -ForegroundColor Red
        exit 1
    }
    Write-Host "Found Node.js: $node" -ForegroundColor Green

    # Find SpockAI
    $spockaiPath = Get-SpockAiPath
    if (-not $spockaiPath) {
        Write-Host "ERROR: SpockAI not found. Please install SpockAI first." -ForegroundColor Red
        exit 1
    }
    Write-Host "Found SpockAI: $spockaiPath" -ForegroundColor Green

    # Check if task exists
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask -and -not $Force) {
        Write-Host "Task '$TaskName' already exists. Use -Force to overwrite." -ForegroundColor Yellow
        exit 0
    }

    # Remove existing task
    if ($existingTask) {
        Write-Host "Removing existing task..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }

    # Create task action
    $entryPoint = Join-Path $spockaiPath "dist\index.js"
    $action = New-ScheduledTaskAction -Execute $node -Argument $entryPoint -WorkingDirectory $spockaiPath

    # Create trigger (at logon)
    $trigger = New-ScheduledTaskTrigger -AtLogon

    # Create settings
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -RestartCount 3 `
        -ExecutionTimeLimit (New-TimeSpan -Hours 0)

    # Create principal (run as current user)
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

    # Register task
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "SpockAI Personal Assistant - Email, Calendar, and Task Management"

    Write-Host ""
    Write-Host "SUCCESS: SpockAI installed as scheduled task '$TaskName'" -ForegroundColor Green
    Write-Host ""
    Write-Host "SpockAI will start automatically at login." -ForegroundColor White
    Write-Host "To start now: Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
    Write-Host "To stop: Stop-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
    Write-Host "To uninstall: .\install.ps1 -Action uninstall" -ForegroundColor White
}

function Uninstall-SpockAI {
    Write-Host "Uninstalling SpockAI..." -ForegroundColor Cyan

    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $existingTask) {
        Write-Host "Task '$TaskName' not found." -ForegroundColor Yellow
        exit 0
    }

    # Stop if running
    if ($existingTask.State -eq "Running") {
        Write-Host "Stopping task..." -ForegroundColor Yellow
        Stop-ScheduledTask -TaskName $TaskName
    }

    # Remove task
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false

    Write-Host "SUCCESS: SpockAI uninstalled" -ForegroundColor Green
}

function Get-SpockAIStatus {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $task) {
        Write-Host "SpockAI is not installed as a service." -ForegroundColor Yellow
        return
    }

    Write-Host "SpockAI Status:" -ForegroundColor Cyan
    Write-Host "  State: $($task.State)" -ForegroundColor White
    Write-Host "  Last Run: $((Get-ScheduledTaskInfo -TaskName $TaskName).LastRunTime)" -ForegroundColor White
    Write-Host "  Next Run: $((Get-ScheduledTaskInfo -TaskName $TaskName).NextRunTime)" -ForegroundColor White
}

# Main
switch ($Action.ToLower()) {
    "install" { Install-SpockAI }
    "uninstall" { Uninstall-SpockAI }
    "status" { Get-SpockAIStatus }
    "start" { Start-ScheduledTask -TaskName $TaskName }
    "stop" { Stop-ScheduledTask -TaskName $TaskName }
    default {
        Write-Host "Usage: .\install.ps1 -Action <install|uninstall|status|start|stop>" -ForegroundColor White
        Write-Host ""
        Write-Host "Actions:" -ForegroundColor Cyan
        Write-Host "  install   - Install SpockAI as a Windows scheduled task" -ForegroundColor White
        Write-Host "  uninstall - Remove SpockAI scheduled task" -ForegroundColor White
        Write-Host "  status    - Show SpockAI service status" -ForegroundColor White
        Write-Host "  start     - Start SpockAI" -ForegroundColor White
        Write-Host "  stop      - Stop SpockAI" -ForegroundColor White
    }
}
