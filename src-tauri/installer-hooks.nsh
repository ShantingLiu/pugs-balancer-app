; Uninstall previous versions that may have been installed under different product names
!macro NSIS_HOOK_PREINSTALL
  ; List of old product names to check and uninstall
  !define OLD_NAME_1 "Stadium PUGs Balancer"
  !define OLD_NAME_2 "Swoos Stadium PUGs Balancer"

  ; Check and silently uninstall old name 1
  ReadRegStr $R0 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${OLD_NAME_1}" "UninstallString"
  ${If} $R0 != ""
    ExecWait '$R0 /S'
  ${EndIf}
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${OLD_NAME_1}" "UninstallString"
  ${If} $R0 != ""
    ExecWait '$R0 /S'
  ${EndIf}

  ; Check and silently uninstall old name 2
  ReadRegStr $R0 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${OLD_NAME_2}" "UninstallString"
  ${If} $R0 != ""
    ExecWait '$R0 /S'
  ${EndIf}
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${OLD_NAME_2}" "UninstallString"
  ${If} $R0 != ""
    ExecWait '$R0 /S'
  ${EndIf}
!macroend

; Refresh Windows Explorer/Taskbar shell icon cache after install or in-place auto-update
!macro NSIS_HOOK_POSTINSTALL
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  ExecWait 'ie4uinit.exe -show'
!macroend
