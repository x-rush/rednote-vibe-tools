$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$projectRoot = (Resolve-Path -LiteralPath '.').Path
$outputRoot = Join-Path $projectRoot 'dist'
$releaseRoot = Join-Path $projectRoot 'release'
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
$zipTarget = Join-Path $releaseRoot 'dandelion-beat-v13-local-preview.zip'
if (-not $zipTarget.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid output path' }
node --expose-internals verify-artifact.cjs $outputRoot
if ($LASTEXITCODE -ne 0) { throw 'Artifact verification failed' }
node .codex/minitool-zip-builder-1.8.0/minitool-zip-builder/scripts/audit_artifact.mjs $outputRoot
if ($LASTEXITCODE -ne 0) { throw 'Directory audit failed' }
Compress-Archive -Path (Join-Path $outputRoot '*') -DestinationPath $zipTarget -CompressionLevel Optimal -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zipTarget)
try {
  $names = @($archive.Entries | ForEach-Object { $_.FullName })
  if (-not ($names -ccontains 'index.html')) { throw 'index.html not at archive root' }
  if (@($names | Where-Object { $_ -match '\.html$' }).Count -ne 1) { throw 'Expected one HTML entry' }
  foreach ($entry in $archive.Entries) {
    if ($entry.FullName -notmatch '\.(html|css|js|json|png|jpg|jpeg|svg|gif|webp|woff|woff2)$') { throw ('Unsupported ZIP entry: ' + $entry.FullName) }
    if ($entry.FullName -match '(^|[/\\])\.\.|^[/\\]|:') { throw 'Unsafe ZIP path' }
    $source = Join-Path $outputRoot $entry.FullName
    $stream = $entry.Open()
    try { $memory = New-Object IO.MemoryStream; $stream.CopyTo($memory); $zipBytes = $memory.ToArray() } finally { $stream.Dispose() }
    $diskBytes = [IO.File]::ReadAllBytes($source)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { if ([Convert]::ToBase64String($sha.ComputeHash($diskBytes)) -cne [Convert]::ToBase64String($sha.ComputeHash($zipBytes))) { throw ('ZIP/source mismatch: ' + $entry.FullName) } } finally { $sha.Dispose(); $memory.Dispose() }
  }
} finally { $archive.Dispose() }
node .codex/minitool-zip-builder-1.8.0/minitool-zip-builder/scripts/audit_artifact.mjs $zipTarget
if ($LASTEXITCODE -ne 0) { throw 'ZIP audit failed' }
$file = Get-Item -LiteralPath $zipTarget
if ($file.Length -gt 10MB) { throw 'ZIP exceeds 10 MiB' }
$hasher = [Security.Cryptography.SHA256]::Create()
try { $hashValue = [BitConverter]::ToString($hasher.ComputeHash([IO.File]::ReadAllBytes($zipTarget))).Replace('-', '') } finally { $hasher.Dispose() }
$manifest = [ordered]@{ name='小草，别服！'; description='踩准节拍，躲过社畜醉拳'; zip=$file.Name; bytes=$file.Length; sha256=$hashValue; entries=$names; sourceAudioBytes=400652; usage='local-preview-only'; platformSimulator='pending'; androidDevice='pending'; iosDevice='pending'; chrome61Runtime='not-tested' }
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $releaseRoot 'manifest.json') -Encoding utf8
$manifest | ConvertTo-Json -Depth 4
