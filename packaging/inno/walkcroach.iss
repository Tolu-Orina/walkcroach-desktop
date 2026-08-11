; WalkCroach Desktop — Windows Inno Setup installer.
;
; Built by scripts/make-windows-inno.mjs. Currently UNSIGNED (preview channel):
; SmartScreen will warn. Do not describe output as signed or notarized.
;
; Structure and registry semantics follow upstream vscode/build/win32/code.iss,
; minus machinery WalkCroach does not ship:
;   - no inno_updater.exe / background updates  -> no VersionedResourcesFolder indirection
;   - no AppX sparse package                    -> classic context menu only (see note below)
;   - no ESRP signing, English-only wizard
;
; The URL protocol (walkcroach://) is deliberately NOT registered here. Electron
; claims it at runtime via app.setAsDefaultProtocolClient() — see
; src/vs/platform/url/electron-main/electronUrlListener.ts. Registering it in the
; installer too would fight that registration on uninstall.
;
; Win11 note: the classic ("legacy") shell verbs below appear under "Show more
; options" on Windows 11. The modern top-level menu requires shipping the AppX
; sparse package + CLSID from product.json win32ContextMenu. Tracked as follow-up.
;
; Defines supplied by ISCC /d (see make-windows-inno.mjs):
;   AppName AppVersion RawVersion AppPublisher AppId Arch ArchInstallIn64BitMode
;   SourceDir OutputDir OutputBaseFilename ExeBasename DirName AppUserModelId
;   NameShort ApplicationName RegValueName ShellNameShort AppMutex RepoDir
;   InstallTarget ("user" | "machine")
; Optional: Sign (enables SignTool), Debug

#ifndef InstallTarget
  #define InstallTarget "user"
#endif

#if "user" == InstallTarget
  #define SoftwareClassesRootKey "HKCU"
  #define EnvironmentRootKey "HKCU"
  #define EnvironmentKey "Environment"
#else
  #define SoftwareClassesRootKey "HKLM"
  #define EnvironmentRootKey "HKLM"
  #define EnvironmentKey "System\CurrentControlSet\Control\Session Manager\Environment"
#endif

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=https://walkcroach.rinegansolutions.com
AppSupportURL=https://github.com/walkcroach/walkcroach-desktop/issues
AppUpdatesURL=https://github.com/walkcroach/walkcroach-desktop/releases
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
AllowNoIcons=yes
UsePreviousAppDir=yes
SourceDir={#SourceDir}
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseFilename}
; ultra64 = LZMA2 with a 64 MB dictionary. Costs build time and ~700 MB RAM in
; the compressor; buys several percent over lzma2/max on a payload this size.
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
WizardStyle=modern
SetupIconFile={#RepoDir}\resources\win32\code.ico
UninstallDisplayIcon={app}\{#ExeBasename}.exe
UninstallDisplayName={#AppName}
MinVersion=10.0
ArchitecturesAllowed={#Arch}
ArchitecturesInstallIn64BitMode={#ArchInstallIn64BitMode}
ChangesEnvironment=yes
ChangesAssociations=yes
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} Setup
VersionInfoProductName={#AppName}
VersionInfoVersion={#RawVersion}

; A stale running instance is the top cause of half-written installs. AppMutex
; blocks setup while WalkCroach is open; CloseApplications=force then shuts down
; any straggler holding a file handle.
AppMutex={#AppMutex}
SetupMutex={#AppMutex}setup
CloseApplications=force
RestartApplications=no

#if "user" == InstallTarget
DefaultDirName={userpf}\{#DirName}
PrivilegesRequired=lowest
#else
DefaultDirName={commonpf}\{#DirName}
PrivilegesRequired=admin
#endif

#ifdef Sign
SignTool=walkcroach
#endif

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
; AdditionalIcons / CreateDesktopIcon / CreateQuickLaunchIcon / LaunchProgram
; already ship in Default.isl — only WalkCroach-specific strings are defined here.
AddContextMenuFiles=Add "Open with %1" action to Windows Explorer file context menu
AddContextMenuFolders=Add "Open with %1" action to Windows Explorer directory context menu
AssociateWithFiles=Register %1 as an editor for supported file types
AddToPath=Add to PATH (requires shell restart)
RunAfter=Run %1 after installation
Other=Other:
SourceFile=%1 Source File
OpenWithContextMenu=Open w&ith %1

; Upgrading in place leaves orphaned modules behind, which both bloats the install
; and lets stale .js shadow new code. Wipe the generated trees before copying.
[InstallDelete]
Type: filesandordirs; Name: "{app}\resources\app\out"
Type: filesandordirs; Name: "{app}\resources\app\extensions"
Type: filesandordirs; Name: "{app}\resources\app\node_modules"
Type: filesandordirs; Name: "{app}\resources\app\node_modules.asar.unpacked"
Type: files; Name: "{app}\resources\app\node_modules.asar"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\_"
Type: filesandordirs; Name: "{app}\bin"
Type: files; Name: "{app}\old_*"
Type: files; Name: "{app}\new_*"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "addcontextmenufiles"; Description: "{cm:AddContextMenuFiles,{#ShellNameShort}}"; GroupDescription: "{cm:Other}"; Flags: unchecked
Name: "addcontextmenufolders"; Description: "{cm:AddContextMenuFolders,{#ShellNameShort}}"; GroupDescription: "{cm:Other}"; Flags: unchecked
Name: "associatewithfiles"; Description: "{cm:AssociateWithFiles,{#ShellNameShort}}"; GroupDescription: "{cm:Other}"
Name: "addtopath"; Description: "{cm:AddToPath}"; GroupDescription: "{cm:Other}"

[Dirs]
Name: "{app}"; AfterInstall: DisableAppDirInheritance

[Files]
; Everything from the gulp package folder. Build-only artifacts are excluded:
; appx/ is unused (no sparse package) and CodeSignSummary is CI bookkeeping.
Source: "*"; Excludes: "\CodeSignSummary*.md,\appx,\appx\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#ExeBasename}.exe"; AppUserModelID: "{#AppUserModelId}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#ExeBasename}.exe"; Tasks: desktopicon; AppUserModelID: "{#AppUserModelId}"

[Run]
Filename: "{app}\{#ExeBasename}.exe"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[Registry]
; --- Generic "open with WalkCroach" handler -------------------------------
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\Applications\{#ExeBasename}.exe"; ValueType: none; ValueName: ""; Flags: uninsdeletekey
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\Applications\{#ExeBasename}.exe\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\resources\app\resources\win32\default.ico"
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\Applications\{#ExeBasename}.exe\shell\open"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\{#ExeBasename}.exe"""
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\Applications\{#ExeBasename}.exe\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#ExeBasename}.exe"" ""%1"""

; Fallback progid for file types with no dedicated icon
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}SourceFile"; ValueType: string; ValueName: ""; ValueData: "{cm:SourceFile,{#AppName}}"; Flags: uninsdeletekey
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}SourceFile\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\resources\app\resources\win32\default.ico"
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}SourceFile\shell\open"; ValueType: string; ValueName: ""; ValueData: """{app}\{#ExeBasename}.exe"""
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}SourceFile\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#ExeBasename}.exe"" ""%1"""

; --- Explorer context menu (classic verbs) --------------------------------
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\*\shell\{#RegValueName}"; ValueType: expandsz; ValueName: ""; ValueData: "{cm:OpenWithContextMenu,{#ShellNameShort}}"; Tasks: addcontextmenufiles; Flags: uninsdeletekey
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\*\shell\{#RegValueName}"; ValueType: expandsz; ValueName: "Icon"; ValueData: "{app}\{#ExeBasename}.exe"; Tasks: addcontextmenufiles
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\*\shell\{#RegValueName}\command"; ValueType: expandsz; ValueName: ""; ValueData: """{app}\{#ExeBasename}.exe"" ""%1"""; Tasks: addcontextmenufiles

; %V (not %1) is required for directory verbs — %1 misresolves on background clicks
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\Directory\shell\{#RegValueName}"; ValueType: expandsz; ValueName: ""; ValueData: "{cm:OpenWithContextMenu,{#ShellNameShort}}"; Tasks: addcontextmenufolders; Flags: uninsdeletekey
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\Directory\shell\{#RegValueName}"; ValueType: expandsz; ValueName: "Icon"; ValueData: "{app}\{#ExeBasename}.exe"; Tasks: addcontextmenufolders
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\Directory\shell\{#RegValueName}\command"; ValueType: expandsz; ValueName: ""; ValueData: """{app}\{#ExeBasename}.exe"" ""%V"""; Tasks: addcontextmenufolders
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\Directory\background\shell\{#RegValueName}"; ValueType: expandsz; ValueName: ""; ValueData: "{cm:OpenWithContextMenu,{#ShellNameShort}}"; Tasks: addcontextmenufolders; Flags: uninsdeletekey
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\Directory\background\shell\{#RegValueName}"; ValueType: expandsz; ValueName: "Icon"; ValueData: "{app}\{#ExeBasename}.exe"; Tasks: addcontextmenufolders
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\Directory\background\shell\{#RegValueName}\command"; ValueType: expandsz; ValueName: ""; ValueData: """{app}\{#ExeBasename}.exe"" ""%V"""; Tasks: addcontextmenufolders
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\Drive\shell\{#RegValueName}"; ValueType: expandsz; ValueName: ""; ValueData: "{cm:OpenWithContextMenu,{#ShellNameShort}}"; Tasks: addcontextmenufolders; Flags: uninsdeletekey
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\Drive\shell\{#RegValueName}"; ValueType: expandsz; ValueName: "Icon"; ValueData: "{app}\{#ExeBasename}.exe"; Tasks: addcontextmenufolders
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\Drive\shell\{#RegValueName}\command"; ValueType: expandsz; ValueName: ""; ValueData: """{app}\{#ExeBasename}.exe"" ""%V"""; Tasks: addcontextmenufolders

; --- Per-extension associations (generated from file-associations.json) ---
#include "generated\associations.iss"

; --- PATH + App Paths -----------------------------------------------------
Root: {#EnvironmentRootKey}; Subkey: "{#EnvironmentKey}"; ValueType: expandsz; ValueName: "Path"; ValueData: "{code:AddToPath|{app}\bin}"; Tasks: addtopath; Check: NeedsAddToPath(ExpandConstant('{app}\bin'))

; Lets `walkcroach` resolve from the Explorer address bar / Run dialog.
; No "Path" value here on purpose: ShellExecute would append it to the launched
; process environment and pollute it.
Root: {#EnvironmentRootKey}; Subkey: "Software\Microsoft\Windows\CurrentVersion\App Paths\{#ApplicationName}.exe"; ValueType: string; ValueName: ""; ValueData: "{app}\{#ExeBasename}.exe"; Flags: uninsdeletekey
Root: {#EnvironmentRootKey}; Subkey: "Software\Microsoft\Windows\CurrentVersion\App Paths\{#ApplicationName}.exe"; ValueType: none; ValueName: "Path"; Flags: deletevalue

[Code]

procedure Explode(var Dest: TArrayOfString; Text: String; Separator: String);
var
  i, p: Integer;
begin
  i := 0;
  repeat
    SetArrayLength(Dest, i+1);
    p := Pos(Separator, Text);
    if p > 0 then begin
      Dest[i] := Copy(Text, 1, p-1);
      Text := Copy(Text, p + Length(Separator), Length(Text));
      i := i + 1;
    end else begin
      Dest[i] := Text;
      Text := '';
    end;
  until Length(Text) = 0;
end;

function NeedsAddToPath(BinDir: string): boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue({#EnvironmentRootKey}, '{#EnvironmentKey}', 'Path', OrigPath) then begin
    Result := True;
    exit;
  end;
  Result := Pos(';' + BinDir + ';', ';' + OrigPath + ';') = 0;
end;

function AddToPath(BinDir: string): string;
var
  OrigPath: string;
begin
  RegQueryStringValue({#EnvironmentRootKey}, '{#EnvironmentKey}', 'Path', OrigPath);

  if (Length(OrigPath) > 0) and (OrigPath[Length(OrigPath)] = ';') then
    Result := OrigPath + BinDir
  else
    Result := OrigPath + ';' + BinDir;
end;

{ Uninstall must remove only our own PATH entry and leave the rest untouched. }
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Path: string;
  BinDir: string;
  Parts: TArrayOfString;
  NewPath: string;
  i: Integer;
begin
  if CurUninstallStep <> usUninstall then begin
    exit;
  end;

  if not RegQueryStringValue({#EnvironmentRootKey}, '{#EnvironmentKey}', 'Path', Path) then begin
    exit;
  end;

  NewPath := '';
  BinDir := ExpandConstant('{app}\bin');
  Explode(Parts, Path, ';');
  for i := 0 to GetArrayLength(Parts)-1 do begin
    if CompareText(Parts[i], BinDir) <> 0 then begin
      if Length(NewPath) > 0 then begin
        NewPath := NewPath + ';';
      end;
      NewPath := NewPath + Parts[i];
    end;
  end;
  RegWriteExpandStringValue({#EnvironmentRootKey}, '{#EnvironmentKey}', 'Path', NewPath);
end;

{ Break ACL inheritance on the install dir so a non-admin cannot drop a DLL that
  a later elevated launch would load. Mirrors upstream code.iss.
  https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/icacls }
procedure DisableAppDirInheritance();
var
  ResultCode: Integer;
  Permissions: string;
begin
  Permissions := '/grant:r "*S-1-5-18:(OI)(CI)F" /grant:r "*S-1-5-32-544:(OI)(CI)F" /grant:r "*S-1-5-11:(OI)(CI)RX" /grant:r "*S-1-5-32-545:(OI)(CI)RX"';

  #if "user" == InstallTarget
    Permissions := Permissions + Format(' /grant:r "*S-1-3-0:(OI)(CI)F" /grant:r "%s:(OI)(CI)F"', [GetUserNameString()]);
  #endif

  Exec(ExpandConstant('{sys}\icacls.exe'), ExpandConstant('"{app}" /inheritancelevel:r ') + Permissions, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

#ifdef Debug
  #expr SaveToFile(AddBackslash(SourcePath) + "walkcroach-processed.iss")
#endif
