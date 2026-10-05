# 페도라용 설치 파일 하나(dist-linux\pjh-desk-fedora.run)를 만든다.
# 구성: installer.sh.in(설치 스크립트) + 그 뒤에 붙인 tar 묶음(app.tar.gz, pjh-lock-fedora.sh, icon.png)
param([switch]$SkipAppBuild)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$lockRoot = Join-Path (Split-Path $root) 'PJH-LOCK'
$outDir = Join-Path $root 'dist-linux'
$version = ([IO.File]::ReadAllText((Join-Path $root 'package.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json).version

if (-not $SkipAppBuild) {
    Push-Location $root
    $env:ELECTRON_RUN_AS_NODE = $null
    npx electron-builder --linux tar.gz --x64 '--config.directories.output=dist-linux'
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "리눅스 앱 빌드 실패" }
    Pop-Location
}

$appTar = Join-Path $outDir "pjh-desk-$version.tar.gz"
$lockSh = Join-Path $lockRoot 'dist\pjh-lock-fedora.sh'
foreach ($f in $appTar, $lockSh) { if (-not (Test-Path $f)) { throw "필요한 파일이 없어요: $f" } }

$stage = Join-Path $env:TEMP 'pjh-desk-fedora-stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null
Copy-Item $appTar (Join-Path $stage 'app.tar.gz')
Copy-Item $lockSh (Join-Path $stage 'pjh-lock-fedora.sh')
Copy-Item (Join-Path $root 'assets\icon.png') (Join-Path $stage 'icon.png')

$payload = Join-Path $stage 'payload.tar'
& "$env:WINDIR\System32\tar.exe" -cf $payload -C $stage app.tar.gz pjh-lock-fedora.sh icon.png
if ($LASTEXITCODE -ne 0) { throw "묶음 만들기 실패" }

$header = ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'installer.sh.in'), [Text.Encoding]::UTF8)).Replace("`r`n", "`n").Replace('@@VERSION@@', $version).TrimEnd("`n") + "`n"
if (-not $header.EndsWith("__PJH_PAYLOAD__`n")) { throw "installer.sh.in 마지막 줄이 __PJH_PAYLOAD__ 이어야 해요" }

$out = Join-Path $outDir 'pjh-desk-fedora.run'
$fs = [IO.File]::Create($out)
$h = (New-Object Text.UTF8Encoding $false).GetBytes($header)
$fs.Write($h, 0, $h.Length)
$p = [IO.File]::ReadAllBytes($payload)
$fs.Write($p, 0, $p.Length)
$fs.Close()
Remove-Item $stage -Recurse -Force
Write-Host ("페도라 설치 파일: {0} ({1:N1} MB)" -f $out, ((Get-Item $out).Length / 1MB))
