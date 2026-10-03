# PJH Desk 아이콘: 검은 타일 + 길이가 다른 흰 줄무늬 세 개(PJH 로고의 줄무늬 느낌).
# assets\icon.png(256), assets\tray.png(16), assets\tray@2x.png(32)를 만든다.
Add-Type -AssemblyName System.Drawing
$assets = Join-Path $PSScriptRoot '..\assets'
New-Item -ItemType Directory -Force $assets | Out-Null

function New-RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
}

function Save-Icon([int]$s, [string]$name) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.PixelOffsetMode = 'HighQuality'
    $g.Clear([System.Drawing.Color]::Transparent)
    $u = $s / 100.0
    $tile = New-RoundRect (2*$u) (2*$u) (96*$u) (96*$u) (20*$u)
    $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(10, 10, 11))), $tile)
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(237, 237, 237))
    $th = [Math]::Max(2.0, 11 * $u)
    $g.FillRectangle($white, (22*$u), (27*$u), (56*$u), $th)
    $g.FillRectangle($white, (22*$u), (45*$u), (40*$u), $th)
    $g.FillRectangle($white, (22*$u), (63*$u), (50*$u), $th)
    $g.Dispose()
    $bmp.Save((Join-Path $assets $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

Save-Icon 256 'icon.png'
Save-Icon 16 'tray.png'
Save-Icon 32 'tray@2x.png'
Write-Host "아이콘 생성: $((Resolve-Path $assets).Path)"
