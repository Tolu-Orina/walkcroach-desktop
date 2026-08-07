@echo off
setlocal
call "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 exit /b 1
set "PATH=C:\Users\toluo\AppData\Roaming\fnm\node-versions\v24.18.0\installation;%PATH%"
set "ForceImportAfterCppTargets=C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\FixLink.props"
set "vs2019_install=C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools"
cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode"

echo === 1) install build/npm/gyp ===
cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode\build\npm\gyp"
call npm ci
if errorlevel 1 (
  echo GYP_CI_FAILED=%ERRORLEVEL%
  exit /b %ERRORLEVEL%
)
echo GYP_CI_OK

echo === 2) run root preinstall (Electron headers) ===
cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode"
set VSCODE_FORCE_INSTALL=1
node --experimental-strip-types build\npm\preinstall.ts > "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\preinstall.log" 2>&1
set EC=%ERRORLEVEL%
echo PREINSTALL_EXIT=%EC%
if not "%EC%"=="0" (
  echo PREINSTALL_FAILED
  exit /b %EC%
)

echo === 3) re-patch Spectre in binding.gyp (in case anything refreshed) ===
node "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\patch-spectre.mjs"

echo === 4) npm rebuild against Electron from .npmrc ===
npm rebuild > "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\npm-rebuild2.log" 2>&1
set EC=%ERRORLEVEL%
echo NPM_REBUILD_EXIT=%EC%
if not "%EC%"=="0" exit /b %EC%

echo === 5) postinstall nested dirs ===
node --experimental-strip-types build\npm\postinstall.ts > "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\npm-postinstall2.log" 2>&1
set EC=%ERRORLEVEL%
echo NPM_POSTINSTALL_EXIT=%EC%
exit /b %EC%
