<#
.SYNOPSIS
    Creates a new feature branch and initializes the spec directory structure.
#>

param(
    [Parameter(Mandatory=$true)]
    [int]$Number,

    [Parameter(Mandatory=$true)]
    [string]$ShortName,

    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Description,

    [switch]$Json
)

$ShortName = $ShortName.ToLower() -replace '\s+', '-'
$branchName = "$Number-$ShortName"
$specDir = "specs/$branchName"
$specFile = "$specDir/spec.md"
$checklistDir = "$specDir/checklists"

try {
    New-Item -ItemType Directory -Force -Path $specDir | Out-Null
    New-Item -ItemType Directory -Force -Path $checklistDir | Out-Null
    $null = git checkout -b $branchName 2>&1

    $templatePath = ".specify/templates/spec-template.md"
    if (Test-Path $templatePath) {
        $template = Get-Content $templatePath -Raw
        $template | Set-Content $specFile -NoNewline
    } else {
        "# Feature Specification: $branchName`n`n**Status**: Draft`n**Created**: $(Get-Date -Format 'yyyy-MM-dd')`n" | Set-Content $specFile -NoNewline
    }

    if ($Json) {
        @{
            BRANCH_NAME = $branchName
            SPEC_FILE = $specFile
            FEATURE_DIR = $specDir
            CHECKLIST_DIR = $checklistDir
            DESCRIPTION = ($Description -join " ")
        } | ConvertTo-Json -Compress
    } else {
        Write-Host "Created feature branch: $branchName"
        Write-Host "Spec file: $specFile"
    }
}
catch {
    Write-Error "Failed to create feature: $_"
    exit 1
}
