@echo off
setlocal
call "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 (
  echo VCVARS_FAILED
  exit /b 1
)
rem AfterCppTargets so our SpectreMitigation=false wins over binding.gyp
set "ForceImportAfterCppTargets=C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\FixLink.props"
set "PATH=C:\Users\toluo\AppData\Roaming\fnm\node-versions\v24.18.0\installation;%PATH%"
cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode"

echo === phase: npm ci --ignore-scripts ===
npm ci --ignore-scripts > "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\npm-ci-ignore.log" 2>&1
if errorlevel 1 (
  echo NPM_CI_IGNORE_FAILED=%ERRORLEVEL%
  exit /b %ERRORLEVEL%
)
echo NPM_CI_IGNORE_OK

echo === phase: inspect deviceid binding.gyp ===
type "node_modules\@vscode\deviceid\binding.gyp"

echo === phase: rebuild deviceid only ===
cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode\node_modules\@vscode\deviceid"
node-gyp rebuild > "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\deviceid-rebuild.log" 2>&1
set EC=%ERRORLEVEL%
echo DEVICEID_REBUILD_EXIT=%EC%
if exist "build\Release\*.node" (
  echo DEVICEID_OK
  dir /b build\Release\*.node
) else (
  echo DEVICEID_MISSING
)
exit /b %EC%
