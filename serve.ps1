param(
  [ValidateRange(1, 65535)]
  [int]$Port = 8080
)

$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$rootPrefix = $root.TrimEnd('\') + '\'
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$contentTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
}

try {
  $listener.Start()
  Write-Host "EULEN Werkstatt läuft auf http://127.0.0.1:$Port/"
  Write-Host "Mit Strg+C beenden."

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      $relativePath = 'index.html'
    }

    $filePath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))
    $isInsideRoot = $filePath -eq $root -or $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
    if (-not $isInsideRoot -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $context.Response.Close()
      continue
    }

    $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $context.Response.ContentType = if ($contentTypes.ContainsKey($extension)) {
      $contentTypes[$extension]
    } else {
      'application/octet-stream'
    }
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  }
} finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
