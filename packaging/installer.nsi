; ============================================================
; SAKAAR ERP — Windows Installer Script (NSIS)
; ============================================================
; Produces a single SakaarERPSetup.exe that a client double-clicks to
; install the whole app — bundled Node runtime, app code, and shortcuts —
; no separate Node.js or npm install needed on their machine.
;
; Compile with: makensis installer.nsi
; (Requires NSIS: https://nsis.sourceforge.io/Download — free, ~3MB)
;
; BEFORE compiling, this folder must contain (see BUILD_INSTRUCTIONS.md
; for exactly how to produce these):
;   packaging/node/          <- portable Node.js win-x64 runtime
;   packaging/app/            <- server.js, package.json, node_modules
;                                 (installed ON Windows so better-sqlite3's
;                                 native binding matches), frontend/
;   packaging/Launch-SakaarERP.vbs
;   packaging/Stop-SakaarERP.vbs
; ============================================================

!define APPNAME "SAKAAR ERP"
!define COMPANYNAME "Your Company Name"
!define VERSION "1.0.0"

Name "${APPNAME}"
OutFile "SakaarERPSetup.exe"
InstallDir "$PROGRAMFILES64\${APPNAME}"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

!include "MUI2.nsh"

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ---------- Core install (always runs) ----------
Section "SAKAAR ERP (required)" SecCore
  SectionIn RO
  SetOutPath "$INSTDIR"
  File /r "node"
  File /r "app"
  File "Launch-SakaarERP.vbs"
  File "Stop-SakaarERP.vbs"

  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "wscript.exe" '"$INSTDIR\Launch-SakaarERP.vbs"'
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Stop ${APPNAME}.lnk" "wscript.exe" '"$INSTDIR\Stop-SakaarERP.vbs"'
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Uninstall.lnk" "$INSTDIR\uninstall.exe"
  CreateShortcut "$DESKTOP\${APPNAME}.lnk" "wscript.exe" '"$INSTDIR\Launch-SakaarERP.vbs"'

  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${COMPANYNAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSION}"
SectionEnd

; ---------- Optional: auto-start with Windows ----------
Section "Start automatically when Windows starts" SecAutostart
  CreateShortcut "$SMSTARTUP\${APPNAME}.lnk" "wscript.exe" '"$INSTDIR\Launch-SakaarERP.vbs"'
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecCore} "The application itself — required."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecAutostart} "Launches ${APPNAME} silently in the background every time this computer starts, so it's always available on your local network without anyone having to open it manually."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ---------- Uninstaller ----------
Section "Uninstall"
  ExecWait 'wscript.exe "$INSTDIR\Stop-SakaarERP.vbs"'
  RMDir /r "$INSTDIR"
  Delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\Stop ${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\Uninstall.lnk"
  RMDir "$SMPROGRAMS\${APPNAME}"
  Delete "$DESKTOP\${APPNAME}.lnk"
  Delete "$SMSTARTUP\${APPNAME}.lnk"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
  MessageBox MB_YESNO "Also delete the database (all saved data)? Choose No to keep it for a future reinstall." IDNO SkipDataDelete
    RMDir /r "$COMMONAPPDATA\SAKAAR ERP"
  SkipDataDelete:
SectionEnd
