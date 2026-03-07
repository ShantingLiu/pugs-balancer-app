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
