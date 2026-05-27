; Magick Cookie — NSIS installer hooks
; Included by Tauri via bundle.windows.nsis.installerHooks
;
; Writes bootstrap.json to %APPDATA%\com.bumblelab.magick-cookie\ once the
; installation completes. The app reads this file on first launch to pre-fill
; folder paths in the first-run wizard, then deletes it.
;
; NOTE: Adding custom pages to the NSIS wizard requires the `template` field
; (full NSIS template). The hooks approach here only writes defaults at install end.

!include "StrFunc.nsh"
${StrRep}

; ─── Called automatically after a successful installation ─────────────────────
Function .onInstSuccess
  ; Default data dirs (relative to user Documents)
  StrCpy $R2 "$DOCUMENTS\MagickCookie\notes"
  StrCpy $R3 "$DOCUMENTS\MagickCookie\workspace"

  ; Create the directories
  CreateDirectory $R2
  CreateDirectory $R3

  ; Escape backslashes for JSON  (C:\foo → C:\\foo)
  ${StrRep} $R0 $R2 "\" "\\"
  ${StrRep} $R1 $R3 "\" "\\"

  ; Create AppData folder for the app
  CreateDirectory "$APPDATA\com.bumblelab.magick-cookie"

  ; Write bootstrap.json
  FileOpen  $9 "$APPDATA\com.bumblelab.magick-cookie\bootstrap.json" w
  FileWrite $9 '{$\n'
  FileWrite $9 '  "notesDir": "$R0",$\n'
  FileWrite $9 '  "workspaceDir": "$R1"$\n'
  FileWrite $9 '}$\n'
  FileClose $9
FunctionEnd
