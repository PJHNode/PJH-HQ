# PJH Desk "지금 재생 중" 도우미 (Windows).
# Windows 미디어 컨트롤(SMTC)에서 지금 재생 중인 곡을 읽어 바뀔 때마다 JSON 한 줄로 내보낸다.
# 표준 입력으로 toggle / next / prev 를 받으면 재생을 조작한다. 입력이 닫히면(위젯 종료) 같이 끝난다.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1

function Await($op, [Type]$type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    [void]$task.Wait(5000)
    return $task.Result
}

$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

# [Console]::In.ReadLineAsync()는 .NET Framework에서 실제로는 동기라 입력이 올 때까지 멈춘다.
# 표준 입력 스트림을 직접 열어 StreamReader로 읽어야 진짜 비동기가 된다.
$stdin = New-Object IO.StreamReader([Console]::OpenStandardInput(), [Text.Encoding]::UTF8)
$pending = $stdin.ReadLineAsync()
$last = ''
$lastSent = [DateTime]::MinValue

while ($true) {
    if ($pending.IsCompleted) {
        $cmd = $pending.Result
        if ($null -eq $cmd) { break }
        $s = $manager.GetCurrentSession()
        if ($s) {
            try {
                switch ($cmd.Trim()) {
                    'toggle' { [void](Await ($s.TryTogglePlayPauseAsync()) ([bool])) }
                    'next' { [void](Await ($s.TrySkipNextAsync()) ([bool])) }
                    'prev' { [void](Await ($s.TrySkipPreviousAsync()) ([bool])) }
                }
            } catch { }
        }
        $pending = $stdin.ReadLineAsync()
        $last = ''
    }

    $state = @{ playing = $false; title = ''; artist = ''; app = ''; status = 'none'; canNext = $false; canPrev = $false }
    try {
        $s = $manager.GetCurrentSession()
        if ($s) {
            $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            $info = $s.GetPlaybackInfo()
            $state.title = [string]$p.Title
            $state.artist = [string]$p.Artist
            $state.app = [string]$s.SourceAppUserModelId
            $state.status = [string]$info.PlaybackStatus
            $state.playing = $state.status -eq 'Playing'
            $state.canNext = [bool]$info.Controls.IsNextEnabled
            $state.canPrev = [bool]$info.Controls.IsPreviousEnabled
        }
    } catch { }

    $json = $state | ConvertTo-Json -Compress
    # 바뀌었을 때, 그리고 살아 있다는 표시로 10초마다 한 번 보낸다.
    if ($json -ne $last -or ([DateTime]::Now - $lastSent).TotalSeconds -ge 10) {
        [Console]::Out.WriteLine($json)
        [Console]::Out.Flush()
        $last = $json
        $lastSent = [DateTime]::Now
    }
    Start-Sleep -Milliseconds 1000
}
