@echo off
setlocal
call "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 (
  echo VCVARS_FAILED
  exit /b 1
)
set "ForceImportBeforeCppTargets=C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\DisableSpectre.props"
set "PATH=C:\Users\toluo\AppData\Roaming\fnm\node-versions\v24.18.0\installation;%PATH%"
cd /d "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\vscode"
echo NODE_VERSION=
node --version
echo CL=
where cl
echo LINK=
where link
echo LIB=%LIB%
echo npm ci starting...
npm ci --foreground-scripts > "C:\Users\toluo\dev\walkcroach\walkcroach-desktop\.d1-logs\npm-ci-vcvars.log" 2>&1
set EC=%ERRORLEVEL%
echo NPM_EXIT=%EC%
exit /b %EC%
