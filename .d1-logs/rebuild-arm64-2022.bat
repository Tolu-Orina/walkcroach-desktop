@echo off
setlocal EnableExtensions
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsarm64.bat"
if errorlevel 1 (
  echo VCVARS_FAILED
  exit /b 1
)

set "PATH=C:\Users\toluo\AppData\Roaming\fnm\node-versions\v24.18.0\installation;%PATH%"
set "vs2022_install=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"
set "FNM_ARCH=arm64"
set "npm_config_arch=arm64"
set "npm_config_target_arch=arm64"
set "GYP_MSVS_VERSION=2022"

cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode"

echo === node/arch ===
node -p "process.version+' '+process.arch"
where cl
cl 2>&1 | findstr /i "Version Microsoft"

echo === 1) electron arm64 binary ===
cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode\node_modules\electron"
if exist dist rmdir /s /q dist
set "npm_config_arch=arm64"
node install.js
if errorlevel 1 (
  echo ELECTRON_INSTALL_FAILED=%ERRORLEVEL%
  exit /b %ERRORLEVEL%
)
cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode"

echo === 2) ensure gyp helpers ===
cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode\build\npm\gyp"
call npm ci
if errorlevel 1 (
  echo GYP_CI_FAILED=%ERRORLEVEL%
  exit /b %ERRORLEVEL%
)

echo === 3) preinstall headers ===
cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode"
set VSCODE_FORCE_INSTALL=1
node --experimental-strip-types build\npm\preinstall.ts
if errorlevel 1 (
  echo PREINSTALL_FAILED=%ERRORLEVEL%
  exit /b %ERRORLEVEL%
)

echo === 4) npm rebuild (arm64 / Electron 42.7) ===
npm rebuild --foreground-scripts
if errorlevel 1 (
  echo NPM_REBUILD_FAILED=%ERRORLEVEL%
  exit /b %ERRORLEVEL%
)

echo === 5) postinstall ===
node --experimental-strip-types build\npm\postinstall.ts
if errorlevel 1 (
  echo POSTINSTALL_FAILED=%ERRORLEVEL%
  exit /b %ERRORLEVEL%
)

echo ALL_OK
exit /b 0
