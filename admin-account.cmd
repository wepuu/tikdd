@echo off
setlocal

set "TIKDD_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "TIKDD_TSX=%~dp0node_modules\tsx\dist\cli.mjs"
set "TIKDD_ACCOUNT_CLI=%~dp0apps\admin-api\src\account-cli.ts"
if not defined DATABASE_URL set "DATABASE_URL=postgresql://tikdd:tikdd@localhost:5432/tikdd"
if not defined REDIS_URL set "REDIS_URL=redis://localhost:16379"

if not exist "%TIKDD_NODE%" (
  echo TikDD could not find the Codex Node.js runtime.
  echo Expected: %TIKDD_NODE%
  exit /b 1
)

if not exist "%TIKDD_TSX%" (
  echo TikDD dependencies are unavailable. Restore node_modules before managing the account.
  exit /b 1
)

"%TIKDD_NODE%" "%TIKDD_TSX%" "%TIKDD_ACCOUNT_CLI%" %*
exit /b %ERRORLEVEL%
