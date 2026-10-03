# PJH Desk 가상 데스크톱 도우미 (Windows).
# 위젯 창(아래 $hwnd)이 지금 보고 있는 가상 데스크톱에 있는지 1초마다 확인해서, 바뀔 때마다 on / off 한 줄을 내보낸다.
# Windows 공식 IVirtualDesktopManager의 IsWindowOnCurrentVirtualDesktop을 쓴다(읽기만 하고 창을 옮기지는 않는다).
# 표준 입력이 닫히면(위젯 종료) 같이 끝난다.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("a5cd92ff-29be-454c-8d04-d82879fb3f1b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IVirtualDesktopManager {
    [PreserveSig] int IsWindowOnCurrentVirtualDesktop(IntPtr topLevelWindow, out int onCurrentDesktop);
    [PreserveSig] int GetWindowDesktopId(IntPtr topLevelWindow, out Guid desktopId);
    [PreserveSig] int MoveWindowToDesktop(IntPtr topLevelWindow, ref Guid desktopId);
}

[ComImport, Guid("aa509086-5ca9-4c25-8f95-589d3c07b48a")]
public class VirtualDesktopManagerClass { }

public static class PjhVDesk {
    static IVirtualDesktopManager manager = (IVirtualDesktopManager)new VirtualDesktopManagerClass();
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);

    // 1 = 지금 데스크톱에 있음, 0 = 다른 데스크톱, -1 = 알 수 없음, -2 = 창이 없어짐
    public static int Check(long hwnd) {
        IntPtr h = new IntPtr(hwnd);
        if (!IsWindow(h)) return -2;
        int on;
        return manager.IsWindowOnCurrentVirtualDesktop(h, out on) == 0 ? (on != 0 ? 1 : 0) : -1;
    }
}
'@

$hwnd = [long]'__HWND__'
$stdin = New-Object IO.StreamReader([Console]::OpenStandardInput(), [Text.Encoding]::UTF8)
$pending = $stdin.ReadLineAsync()
$last = $null

while ($true) {
    if ($pending.IsCompleted) {
        if ($null -eq $pending.Result) { break }
        $pending = $stdin.ReadLineAsync()
    }
    $state = switch ([PjhVDesk]::Check($hwnd)) { 1 { 'on' } 0 { 'off' } -2 { 'gone' } default { 'unknown' } }
    if ($state -ne $last) {
        [Console]::Out.WriteLine($state)
        [Console]::Out.Flush()
        $last = $state
    }
    if ($state -eq 'gone') { break }
    Start-Sleep -Milliseconds 1000
}
