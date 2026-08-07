@echo off
setlocal
call "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 exit /b 1
set "PATH=C:\Users\toluo\AppData\Roaming\fnm\node-versions\v24.18.0\installation;%PATH%"
set "ForceImportAfterCppTargets=C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\FixLink.props"
set "vs2019_install=C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools"
cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode"

echo === postinstall nested dirs ===
node --experimental-strip-types build\npm\postinstall.ts > "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\npm-postinstall3.log" 2>&1
set EC=%ERRORLEVEL%
echo NPM_POSTINSTALL_EXIT=%EC%
exit /b %EC%
