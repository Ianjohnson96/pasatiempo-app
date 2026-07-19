# Dev server launcher for the Pasatiempo umbrella app (used by the preview tooling).
$env:Path = "C:\Users\ianjo\nodejs\node-v24.18.0-win-x64;$env:Path"
Set-Location $PSScriptRoot
npm run dev -- -p 3300
