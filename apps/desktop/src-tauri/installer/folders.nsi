; Magick Cookie — Custom NSIS pages
; Injected by Tauri via bundle.windows.nsis.customNsisScript
;
; Adds two pages BEFORE the standard install location page:
;   1. Folder selection (notes root + workspace root)
;
; The chosen paths are written to:
;   %APPDATA%\com.bumblelab.magick-cookie\bootstrap.json
; which the app reads once on first launch (bootstrap.rs).

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; ─── String replace helper (needed to escape backslashes for JSON) ─────────────
!include "StrFunc.nsh"
${StrRep}

; ─── Variables ────────────────────────────────────────────────────────────────
Var NotesDir
Var WorkspaceDir

Var NotesDirCtrl
Var WorkspaceDirCtrl

; ─── Insert our custom page before the standard InstDir page ──────────────────
; Tauri's NSIS wrapper defines !insertmacro MUI_PAGE_INSTFILES after components,
; so we hook in with PageEx / PageExEnd to add our page right before confirmation.
!insertmacro MUI_PAGE_CUSTOM FoldersPage FoldersPageLeave

; ══════════════════════════════════════════════════════════════════════════════
; PAGE — Choisir les emplacements des données
; ══════════════════════════════════════════════════════════════════════════════
Function FoldersPage
  ; Valeurs par défaut (Documents\MagickCookie)
  StrCpy $NotesDir    "$DOCUMENTS\MagickCookie\notes"
  StrCpy $WorkspaceDir "$DOCUMENTS\MagickCookie\workspace"

  nsDialogs::Create 1018
  Pop $0

  ; ── Titre ──────────────────────────────────────────────────────────────────
  ${NSD_CreateLabel} 0 0 100% 16u "Choisissez où stocker vos données :"
  Pop $0
  ${NSD_AddStyle} $0 ${SS_LEFT}

  ; ── Notes / Vault ──────────────────────────────────────────────────────────
  ${NSD_CreateGroupBox} 0 20u 100% 46u "Notes & Coffre-fort (KDBX)"
  Pop $0

  ${NSD_CreateLabel}      8u 32u 84% 10u \
    "Dossier racine pour vos notes Markdown et votre vault chiffré."
  Pop $0

  ${NSD_CreateDirRequest} 8u 46u 74% 13u $NotesDir
  Pop $NotesDirCtrl

  ${NSD_CreateBrowseButton} 84u 46u 14% 13u "..."
  Pop $0
  ${NSD_OnClick} $0 OnBrowseNotes

  ; ── Workspace ──────────────────────────────────────────────────────────────
  ${NSD_CreateGroupBox} 0 72u 100% 46u "Workspace (projets)"
  Pop $0

  ${NSD_CreateLabel}      8u 84u 84% 10u \
    "Dossier racine pour vos projets de code détectés automatiquement."
  Pop $0

  ${NSD_CreateDirRequest} 8u 98u 74% 13u $WorkspaceDir
  Pop $WorkspaceDirCtrl

  ${NSD_CreateBrowseButton} 84u 98u 14% 13u "..."
  Pop $0
  ${NSD_OnClick} $0 OnBrowseWorkspace

  ; ── Note d'information ─────────────────────────────────────────────────────
  ${NSD_CreateLabel} 0 124u 100% 20u \
    "Vous pourrez modifier ces chemins à tout moment dans Paramètres."
  Pop $0

  nsDialogs::Show
FunctionEnd

; ── Boutons Parcourir ─────────────────────────────────────────────────────────
Function OnBrowseNotes
  ${NSD_GetText} $NotesDirCtrl $0
  nsDialogs::SelectFolderDialog "Dossier Notes & Vault" $0
  Pop $0
  ${If} $0 != error
    ${NSD_SetText} $NotesDirCtrl $0
  ${EndIf}
FunctionEnd

Function OnBrowseWorkspace
  ${NSD_GetText} $WorkspaceDirCtrl $0
  nsDialogs::SelectFolderDialog "Dossier Workspace" $0
  Pop $0
  ${If} $0 != error
    ${NSD_SetText} $WorkspaceDirCtrl $0
  ${EndIf}
FunctionEnd

; ── Lecture + écriture bootstrap.json ─────────────────────────────────────────
Function FoldersPageLeave
  ; Récupère les valeurs saisies
  ${NSD_GetText} $NotesDirCtrl    $NotesDir
  ${NSD_GetText} $WorkspaceDirCtrl $WorkspaceDir

  ; Crée les dossiers si inexistants
  CreateDirectory $NotesDir
  CreateDirectory $WorkspaceDir

  ; Échappe les backslashes pour JSON  (C:\foo → C:\\foo)
  ${StrRep} $R0 $NotesDir     "\" "\\"
  ${StrRep} $R1 $WorkspaceDir "\" "\\"

  ; Crée le dossier AppData de l'app si nécessaire
  CreateDirectory "$APPDATA\com.bumblelab.magick-cookie"

  ; Écrit bootstrap.json
  FileOpen  $9 "$APPDATA\com.bumblelab.magick-cookie\bootstrap.json" w
  FileWrite $9 '{$\n'
  FileWrite $9 '  "notesDir": "$R0",$\n'
  FileWrite $9 '  "workspaceDir": "$R1"$\n'
  FileWrite $9 '}$\n'
  FileClose $9
FunctionEnd
