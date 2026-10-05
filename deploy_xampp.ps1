param(
    [switch]$SkipInstall,
    [switch]$ConfigureApache,
    [switch]$FrontendOnly
)

$ErrorActionPreference = 'Stop'
if ($FrontendOnly -and $ConfigureApache) { throw 'FrontendOnly cannot configure Apache.' }
$project = $PSScriptRoot
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$frontendDir = Join-Path $project 'frontend'
$backendDir = Join-Path $project 'backend'
$values = @{}
$envFile = Join-Path $project '.env'
if (-not (Test-Path -LiteralPath $envFile)) { throw 'Missing .env: copy .env.example and set this machine''s values first.' }

foreach ($line in [System.IO.File]::ReadAllLines($envFile)) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
        $values[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
    }
}

$base = $values['APP_BASE_PATH']
$port = $values['PORT']
$xampp = $values['XAMPP_ROOT']
$documentRoot = $values['APACHE_DOCUMENT_ROOT']
$appUrl = $values['APP_URL']
if ($base -notmatch '^/[A-Za-z0-9/_-]+/$' -or $base -match '\.\.') { throw 'APP_BASE_PATH must be a safe absolute directory path ending in /.' }
if ($port -notmatch '^\d{1,5}$' -or [int]$port -lt 1 -or [int]$port -gt 65535) { throw 'PORT must be a valid TCP port.' }
$publicUrl = $null
if (-not [Uri]::TryCreate($appUrl, [UriKind]::Absolute, [ref]$publicUrl)) { throw 'APP_URL must be an absolute URL.' }
if ($publicUrl.AbsolutePath.TrimEnd('/') -ne $base.TrimEnd('/')) { throw 'APP_URL path must match APP_BASE_PATH.' }
if (-not (Test-Path -LiteralPath $xampp -PathType Container)) { throw "XAMPP_ROOT does not exist: $xampp" }
if (-not $documentRoot) { $documentRoot = Join-Path $xampp 'htdocs' }
if (-not [System.IO.Path]::IsPathRooted($documentRoot)) { throw 'APACHE_DOCUMENT_ROOT must be an absolute path.' }
if (-not (Test-Path -LiteralPath $documentRoot -PathType Container)) { throw "APACHE_DOCUMENT_ROOT does not exist: $documentRoot" }

$httpdConf = Join-Path $xampp 'apache/conf/httpd.conf'
$httpdExe = Join-Path $xampp 'apache/bin/httpd.exe'
$documentRoot = [System.IO.Path]::GetFullPath($documentRoot)
$relativeBase = $base.Trim('/') -replace '/', [System.IO.Path]::DirectorySeparatorChar
$destination = [System.IO.Path]::GetFullPath((Join-Path $documentRoot $relativeBase))
if (-not $destination.StartsWith($documentRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Deploy destination must be inside APACHE_DOCUMENT_ROOT.' }

if (-not $SkipInstall) {
    if (-not $FrontendOnly) {
        & $npm --prefix $backendDir ci --offline=false --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Backend npm install failed.' }
    }
    & $npm --prefix $frontendDir ci --offline=false --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Frontend npm install failed.' }
}

& $npm --prefix $frontendDir run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
$dist = Join-Path $project 'frontend/dist'

$htaccess = @"
Options -Indexes
<IfModule mod_headers.c>
    <Files "index.html">
        Header always set Cache-Control "no-cache, must-revalidate"
    </Files>
</IfModule>
RewriteEngine On
RewriteBase $base
RewriteRule ^(api|uploads)(/|`$) - [END]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [END]
"@
[System.IO.File]::WriteAllText((Join-Path $dist '.htaccess'), $htaccess)

if ($FrontendOnly) {
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Copy-Item -Path (Join-Path $dist '*') -Destination $destination -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $dist '.htaccess') -Destination $destination -Force
    Write-Host "Deployed frontend to $destination"
    Write-Host "URL: $($appUrl.TrimEnd('/'))/"
    return
}

$apacheConfig = @"
<IfModule !proxy_module>
    LoadModule proxy_module modules/mod_proxy.so
</IfModule>
<IfModule !proxy_http_module>
    LoadModule proxy_http_module modules/mod_proxy_http.so
</IfModule>
<IfModule !rewrite_module>
    LoadModule rewrite_module modules/mod_rewrite.so
</IfModule>
ProxyRequests Off
ProxyPass "${base}api/" "http://127.0.0.1:${port}/api/"
ProxyPassReverse "${base}api/" "http://127.0.0.1:${port}/api/"
ProxyPass "${base}uploads/" "http://127.0.0.1:${port}/uploads/"
ProxyPassReverse "${base}uploads/" "http://127.0.0.1:${port}/uploads/"
<Directory "$($destination.Replace('\', '/'))">
    AllowOverride All
    Require all granted
</Directory>
"@
$generatedConf = Join-Path $project 'deployment/apache-somtop.local.conf'
New-Item -ItemType Directory -Path (Split-Path $generatedConf) -Force | Out-Null
[System.IO.File]::WriteAllText($generatedConf, $apacheConfig)

if ($ConfigureApache) {
    if (-not (Test-Path -LiteralPath $httpdConf)) { throw "Missing Apache config: $httpdConf" }
    $activeConf = Join-Path $xampp 'apache/conf/extra/somtop.conf'
    $includeLine = 'Include "' + $activeConf.Replace('\', '/') + '"'
    $legacyIncludeLine = 'Include "' + $generatedConf.Replace('\', '/') + '"'
    $original = [System.IO.File]::ReadAllText($httpdConf)
    $previousActiveConf = if (Test-Path -LiteralPath $activeConf) { [System.IO.File]::ReadAllText($activeConf) } else { $null }
    $updated = $original.Replace($legacyIncludeLine, $includeLine)
    if (-not $updated.Contains($includeLine)) {
        $updated += "`r`n# Somtop deployment`r`n$includeLine`r`n"
    }
    $backup = "$httpdConf.somtop.bak"
    [System.IO.File]::Copy($httpdConf, $backup, $true)
    [System.IO.File]::WriteAllText($activeConf, $apacheConfig)
    if ($updated -ne $original) { [System.IO.File]::WriteAllText($httpdConf, $updated) }
    Write-Host "Apache config backup: $backup"
    & $httpdExe -t
    if ($LASTEXITCODE -ne 0) {
        [System.IO.File]::WriteAllText($httpdConf, $original)
        if ($null -eq $previousActiveConf) { Remove-Item -LiteralPath $activeConf -Force } else { [System.IO.File]::WriteAllText($activeConf, $previousActiveConf) }
        throw 'Apache syntax check failed; previous config was restored.'
    }
}

New-Item -ItemType Directory -Path $destination -Force | Out-Null
Copy-Item -Path (Join-Path $dist '*') -Destination $destination -Recurse -Force
Copy-Item -LiteralPath (Join-Path $dist '.htaccess') -Destination $destination -Force
Write-Host "Deployed frontend to $destination"
Write-Host "URL: $($appUrl.TrimEnd('/'))/"
if ($ConfigureApache) { Write-Host 'Restart Apache now to activate or refresh the Somtop proxy routes.' }
if (-not $ConfigureApache) { Write-Host 'Run with -ConfigureApache to install the generated proxy config, then restart Apache.' }
