# Resizes only launcher artwork, leaving splash and web assets unchanged.
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path $PSScriptRoot -Parent
$source = [System.Drawing.Image]::FromFile((Join-Path $projectRoot 'assets/wisal-android-logo-source.png'))
if ($source.Width -ne $source.Height) { throw 'Launcher artwork must be square' }
$background = [System.Drawing.ColorTranslator]::FromHtml('#070811')
function Write-Icon($target, [int]$size, [double]$ratio, [bool]$transparent = $false, [bool]$round = $false) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        if ($round) {
            $brush = New-Object System.Drawing.SolidBrush($background)
            try { $graphics.FillEllipse($brush, 0, 0, $size, $size) } finally { $brush.Dispose() }
        } elseif (!$transparent) { $graphics.Clear($background) }
        if ($ratio -gt 0) {
            $side = [int][Math]::Floor($size * $ratio)
            $offset = [int][Math]::Floor(($size - $side) / 2)
            $graphics.DrawImage($source, $offset, $offset, $side, $side)
        }
        $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
}
try {
    Write-Icon (Join-Path $projectRoot 'assets/icon-only.png') 1024 1
    # A 46dp square fits entirely within the guaranteed 66dp safe circle.
    Write-Icon (Join-Path $projectRoot 'assets/icon-foreground.png') 1024 (46/108) $true
    Write-Icon (Join-Path $projectRoot 'assets/icon-background.png') 1024 0
    $densities = @(@('ldpi',36,81),@('mdpi',48,108),@('hdpi',72,162),@('xhdpi',96,216),@('xxhdpi',144,324),@('xxxhdpi',192,432))
    foreach ($density in $densities) {
        $directory = Join-Path $projectRoot "android/app/src/main/res/mipmap-$($density[0])"
        Write-Icon (Join-Path $directory 'ic_launcher.png') $density[1] 1
        Write-Icon (Join-Path $directory 'ic_launcher_round.png') $density[1] 0.70 $false $true
        Write-Icon (Join-Path $directory 'ic_launcher_foreground.png') $density[2] (46/108) $true
        Write-Icon (Join-Path $directory 'ic_launcher_background.png') $density[2] 0
        Write-Output "$($density[0]): $($density[1])px legacy / $($density[2])px adaptive"
    }
} finally { $source.Dispose() }
