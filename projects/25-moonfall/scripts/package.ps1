$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$project = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dist = Join-Path $project 'dist'
$exports = Join-Path $project 'exports'
$contentPath = Join-Path $project 'src/content/content.json'
$content = Get-Content -LiteralPath $contentPath -Raw -Encoding utf8 | ConvertFrom-Json
$logo = Join-Path $project $content.brand.logo
$cover = Join-Path $project $content.brand.xiaohongshuCover
$video = Join-Path $project $content.xiaohongshuDraft.video
$miniZip = Join-Path $exports 'yueliu-minitool-upload.zip'
$promoZip = Join-Path $exports 'yueliu-promo-kit.zip'
$allowed = @('.html', '.css', '.js', '.json', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.woff', '.woff2', '.webp')

foreach ($path in @($dist, $logo, $cover, $video, $contentPath)) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing package input: $path" }
}
New-Item -ItemType Directory -Force -Path $exports | Out-Null
$files = @(Get-ChildItem -LiteralPath $dist -Recurse -File)
if ($files.Count -eq 0) { throw 'Static build is empty' }
foreach ($file in $files) {
  if ($allowed -notcontains $file.Extension.ToLowerInvariant()) { throw "Forbidden upload type: $($file.FullName)" }
}

foreach ($archivePath in @($miniZip, $promoZip)) {
  if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath }
}

$archive = [System.IO.Compression.ZipFile]::Open($miniZip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    $entryName = [System.IO.Path]::GetRelativePath($dist, $file.FullName).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose() }

$archive = [System.IO.Compression.ZipFile]::Open($promoZip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $logo, 'logo.png', [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $cover, 'xiaohongshu-cover.png', [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $video, 'moonfall-xiaohongshu.mp4', [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  $draft = $content.xiaohongshuDraft
  $note = $draft.title + "`r`n`r`n" + $draft.body + "`r`n`r`n" + (($draft.hashtags | ForEach-Object { '#' + $_ }) -join ' ')
  $entry = $archive.CreateEntry('note.txt')
  $writer = [System.IO.StreamWriter]::new($entry.Open(), [System.Text.UTF8Encoding]::new($false))
  try { $writer.Write($note) } finally { $writer.Dispose() }
} finally { $archive.Dispose() }

$check = [System.IO.Compression.ZipFile]::OpenRead($miniZip)
try {
  $names = @($check.Entries | ForEach-Object { $_.FullName })
  if ($names -notcontains 'index.html') { throw 'index.html is not at the ZIP root' }
  foreach ($name in $names) {
    if ($allowed -notcontains [System.IO.Path]::GetExtension($name).ToLowerInvariant()) { throw "Forbidden ZIP entry: $name" }
  }
} finally { $check.Dispose() }
if ((Get-Item -LiteralPath $miniZip).Length -gt 10MB) { throw 'Upload ZIP exceeds 10 MiB' }
Get-Item -LiteralPath $miniZip, $promoZip | Select-Object Name, Length
