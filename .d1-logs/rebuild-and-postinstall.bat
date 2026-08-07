@echo off
setlocal
call "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 exit /b 1
set "PATH=C:\Users\toluo\AppData\Roaming\fnm\node-versions\v24.18.0\installation;%PATH%"
set "ForceImportAfterCppTargets=C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\FixLink.props"
cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode"

echo === npm rebuild (native modules) ===
npm rebuild > "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\npm-rebuild.log" 2>&1
set EC=%ERRORLEVEL%
echo NPM_REBUILD_EXIT=%EC%
if not "%EC%"=="0" (
  echo REBUILD_FAILED — see npm-rebuild.log
  exit /b %EC%
)

echo === postinstall (electron + nested) ===
npm run postinstall > "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\npm-postinstall.log" 2>&1
set EC=%ERRORLEVEL%
echo NPM_POSTINSTALL_EXIT=%EC%
exit /b %EC%
