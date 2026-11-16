[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$script:lastQTEnvDevDir = $null
$script:allowedPathsCache = $null

function global:Prompt {
  if ($null -eq $script:allowedPathsCache) {
    $script:allowedPathsCache = Get-QTEnvDevAllowedPaths
  }

  $currentPath = $PWD.Path.Replace('/', '\').TrimEnd('\')
  $isAllowed = $script:allowedPathsCache -contains $currentPath

  if ($isAllowed -and (Test-Path ".qtenvdev") -and ($currentPath -ne $script:lastQTEnvDevDir)) {
    Write-Host "[QTEnvDev] Loading environment variables..." -ForegroundColor Cyan
    try {
      Get-Content ".qtenvdev" -Encoding UTF8 | Invoke-Expression
      Write-Host "[QTEnvDev] Load successful" -ForegroundColor Green
      $script:lastQTEnvDevDir = $currentPath
    } catch {
      Write-Host "[QTEnvDev] Load failed: $_" -ForegroundColor Red
    }
  }

  if ($PSVersionTable.PSVersion.Major -ge 6) {
    "PS $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) "
  } else {
    "PS $($pwd.Path)$('>' * ($nestedPromptLevel + 1)) "
  }
}

function Get-QTEnvDevAllowedPaths {
  $configFile = Join-Path $PSScriptRoot ".qtenvdev.dir"
  if (Test-Path $configFile) {
    try {
      $jsonContent = Get-Content $configFile -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
      return $jsonContent | Where-Object { $_ -ne $null } | ForEach-Object {
        $_.ToString().Replace('/', '\').TrimEnd('\')
      }
    } catch {
      return @()
    }
  } else {
    return @()
  }
}
