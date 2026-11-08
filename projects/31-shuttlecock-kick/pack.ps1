$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$projectRoot = (Resolve-Path -LiteralPath '.').Path
$outputRoot = Join-Path $projectRoot 'dist'
$releaseRoot = Join-Path $projectRoot 'release'
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
$zipTarget = Join-Path $releaseRoot 'shuttlecock-kick-v1.zip'
if (-not $zipTarget.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid output path' }

node verify-artifact.cjs $outputRoot
if ($LASTEXITCODE -ne 0) { throw 'Artifact verification failed' }

$repoAudit = Join-Path (Split-Path -Parent $projectRoot) '..\.codex\minitool-zip-builder\scripts\audit_artifact.mjs'
if (Test-Path -LiteralPath $repoAudit) {
  node $repoAudit $outputRoot
  if ($LASTEXITCODE -ne 0) { throw 'Directory audit failed' }
}

# 按小工具开发规范写高消耗标记（mini_tool.json，与 index.html 同级）：
# 本项目只用 Canvas 2D / Web Audio / localStorage，未使用 Worker、离屏渲染、
# WebAssembly 或 Unity/Cocos 等游戏引擎 → is_high_consumption_scene = false
$manifestWriter = Join-Path (Split-Path -Parent $projectRoot) '..\.codex\minitool-zip-builder\scripts\write_manifest.mjs'
if (Test-Path -LiteralPath $manifestWriter) {
  node $manifestWriter $outputRoot false
  if ($LASTEXITCODE -ne 0) { throw 'mini_tool.json generation failed' }
}

# 压缩 dist 的「内容」而不是 dist 目录本身：解压后 index.html 必须直接位于根目录
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

if (Test-Path -LiteralPath $repoAudit) {
  node $repoAudit $zipTarget
  if ($LASTEXITCODE -ne 0) { throw 'ZIP audit failed' }
}

$file = Get-Item -LiteralPath $zipTarget
if ($file.Length -gt 10MB) { throw 'ZIP exceeds 10 MiB' }
$hasher = [Security.Cryptography.SHA256]::Create()
try { $hashValue = [BitConverter]::ToString($hasher.ComputeHash([IO.File]::ReadAllBytes($zipTarget))).Replace('-', '') } finally { $hasher.Dispose() }
$manifest = [ordered]@{
  name = '毽子连击'
  description = '一脚接一脚，踢到天黑'
  zip = $file.Name
  bytes = $file.Length
  sha256 = $hashValue
  entries = $names
  sourceAudioBytes = 0
  usage = 'local-preview-only'
  platformSimulator = 'pending'
  androidDevice = 'pending'
  iosDevice = 'pending'
  chrome61Runtime = 'not-tested'
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $releaseRoot 'manifest.json') -Encoding utf8
$manifest | ConvertTo-Json -Depth 4
