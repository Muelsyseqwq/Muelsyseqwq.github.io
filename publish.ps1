<#
.SYNOPSIS
  Validate, commit, and publish this blog to GitHub.

.EXAMPLE
  .\publish.ps1

.EXAMPLE
  .\publish.ps1 -Message "Update TOFC article"

.EXAMPLE
  .\publish.ps1 -DryRun
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Message,

  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-NativeStep {
  param(
    [Parameter(Mandatory)]
    [string]$Name,

    [Parameter(Mandatory)]
    [scriptblock]$Command
  )

  Write-Host "`n==> $Name" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE."
  }
}

function Get-GitOutput {
  param(
    [Parameter(Mandatory)]
    [string[]]$Arguments
  )

  $output = & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }

  return ($output | Out-String).Trim()
}

function Test-StagedSecrets {
  $textExtensions = @(
    ".astro",
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mdx",
    ".mjs",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml"
  )

  $secretPattern = '(?im)(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password)\s*[:=]\s*["''][^"''\r\n]{8,}["''])'
  $suspectFiles = [System.Collections.Generic.List[string]]::new()
  $stagedFiles = Get-GitOutput -Arguments @(
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMR"
  )

  foreach ($relativePath in ($stagedFiles -split "`r?`n")) {
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      continue
    }

    $extension = [IO.Path]::GetExtension($relativePath).ToLowerInvariant()
    if ($extension -notin $textExtensions -or -not (Test-Path -LiteralPath $relativePath -PathType Leaf)) {
      continue
    }

    $content = Get-Content -Raw -LiteralPath $relativePath
    if ($content -match $secretPattern) {
      $suspectFiles.Add($relativePath)
    }
  }

  if ($suspectFiles.Count -gt 0) {
    throw "Possible secret detected. Review these files before publishing: $($suspectFiles -join ', ')"
  }
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$astroCli = Join-Path $repoRoot "node_modules\.bin\astro.cmd"
$devServerWasRunning = $false
Push-Location $repoRoot

try {
  if (-not (Test-Path -LiteralPath ".git" -PathType Container)) {
    throw "This script must be placed in the root of a Git repository."
  }

  foreach ($commandName in @("git", "node", "npm")) {
    if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
      throw "Required command '$commandName' was not found in PATH."
    }
  }

  $branch = Get-GitOutput -Arguments @("branch", "--show-current")
  if ([string]::IsNullOrWhiteSpace($branch)) {
    throw "Detached HEAD is not supported. Check out a branch before publishing."
  }

  & git remote get-url origin *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Git remote 'origin' is not configured."
  }

  $unmergedFiles = Get-GitOutput -Arguments @(
    "diff",
    "--name-only",
    "--diff-filter=U"
  )
  if (-not [string]::IsNullOrWhiteSpace($unmergedFiles)) {
    throw "Resolve merge conflicts before publishing: $($unmergedFiles -replace "`r?`n", ', ')"
  }

  Invoke-NativeStep -Name "Fetch origin" -Command { git fetch origin }

  & git show-ref --verify --quiet "refs/remotes/origin/$branch"
  $remoteBranchExists = $LASTEXITCODE -eq 0
  if ($remoteBranchExists) {
    $behindCount = [int](Get-GitOutput -Arguments @(
        "rev-list",
        "--count",
        "HEAD..origin/$branch"
      ))

    if ($behindCount -gt 0) {
      if ($DryRun) {
        throw "origin/$branch is ahead by $behindCount commit(s). Run the script without -DryRun to synchronize first."
      }

      Invoke-NativeStep -Name "Rebase onto origin/$branch" -Command {
        git pull --rebase --autostash origin $branch
      }
    }
  }

  if (Test-Path -LiteralPath $astroCli -PathType Leaf) {
    $devStatus = & $astroCli dev status 2>&1
    $devServerWasRunning =
      $LASTEXITCODE -eq 0 -and ($devStatus -match "Dev server running")
    if ($devServerWasRunning) {
      Invoke-NativeStep -Name "Temporarily stop Astro dev server" -Command {
        & $astroCli dev stop
      }
    }
  }

  Invoke-NativeStep -Name "Install locked dependencies" -Command { npm ci }
  Invoke-NativeStep -Name "Run ESLint" -Command { npm run lint }
  Invoke-NativeStep -Name "Build production site" -Command { npm run build }

  if ($DryRun) {
    Write-Host "`n==> Changes that would be published" -ForegroundColor Cyan
    git status --short --untracked-files=all -- . ":(exclude)AGENTS.md" ":(exclude)CLAUDE.md"
    Write-Host "`nDry run completed. Nothing was committed or pushed." -ForegroundColor Green
    exit 0
  }

  Invoke-NativeStep -Name "Stage publishable changes" -Command {
    git add --all -- . ":(exclude)AGENTS.md" ":(exclude)CLAUDE.md"
  }

  & git diff --cached --quiet
  $diffExitCode = $LASTEXITCODE
  if ($diffExitCode -eq 0) {
    Write-Host "`nNo publishable changes were found." -ForegroundColor Yellow
    exit 0
  }
  if ($diffExitCode -ne 1) {
    throw "Unable to inspect staged changes (exit code $diffExitCode)."
  }

  Invoke-NativeStep -Name "Check staged whitespace" -Command {
    git diff --cached --check
  }
  Test-StagedSecrets

  Write-Host "`n==> Staged summary" -ForegroundColor Cyan
  git diff --cached --stat

  if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = "Update blog $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  }

  Invoke-NativeStep -Name "Create commit" -Command {
    git commit -m $Message
  }
  Invoke-NativeStep -Name "Push $branch to GitHub" -Command {
    git push origin $branch
  }

  $commit = Get-GitOutput -Arguments @("rev-parse", "--short", "HEAD")
  Write-Host "`nPublished successfully: $commit on $branch" -ForegroundColor Green
  Write-Host "GitHub Pages deployment will start automatically." -ForegroundColor Green
}
catch {
  Write-Host "`nPublish stopped: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
finally {
  if ($devServerWasRunning -and (Test-Path -LiteralPath $astroCli -PathType Leaf)) {
    Write-Host "`n==> Restart Astro dev server" -ForegroundColor Cyan
    & $astroCli dev --background
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "The blog was published, but the local Astro dev server could not be restarted."
    }
  }
  Pop-Location
}
