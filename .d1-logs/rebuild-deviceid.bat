@echo off
setlocal
call "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 exit /b 1
set "PATH=C:\Users\toluo\AppData\Roaming\fnm\node-versions\v24.18.0\installation;%PATH%"
set "ForceImportAfterCppTargets=C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\FixLink.props"
cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode\node_modules\@vscode\deviceid"

REM Use npm's bundled node-gyp
set "GYP=C:\Users\toluo\AppData\Roaming\fnm\node-versions\v24.18.0\installation\node_modules\npm\node_modules\node-gyp\bin\node-gyp.js"
if not exist "%GYP%" (
  echo GYP_NOT_FOUND
  where /r "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode\node_modules" node-gyp.js 2>nul
  exit /b 2
)
echo Using %GYP%
node "%GYP%" rebuild
set EC=%ERRORLEVEL%
echo DEVICEID_REBUILD_EXIT=%EC%
dir /b build\Release\*.node 2>nul && echo DEVICEID_OK || echo DEVICEID_MISSING
exit /b %EC%
