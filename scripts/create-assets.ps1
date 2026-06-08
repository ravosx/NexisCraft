Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$root = Split-Path -Parent $PSScriptRoot
$assetDir = Join-Path $root "public\assets"
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

function New-Brush($color) {
    return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($color))
}

function New-Pen($color, $width = 1) {
    return New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($color)), $width
}

function Save-Hero {
    $w = 1600
    $h = 900
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $sky = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Rectangle]::new(0, 0, $w, $h),
        [System.Drawing.ColorTranslator]::FromHtml("#271b43"),
        [System.Drawing.ColorTranslator]::FromHtml("#08110d"),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $g.FillRectangle($sky, 0, 0, $w, $h)

    $starBrush = New-Brush "#f4efe3"
    for ($i = 0; $i -lt 130; $i++) {
        $x = Get-Random -Minimum 0 -Maximum $w
        $y = Get-Random -Minimum 0 -Maximum 390
        $s = Get-Random -Minimum 1 -Maximum 4
        $g.FillRectangle($starBrush, $x, $y, $s, $s)
    }

    $moonBrush = New-Brush "#e8d7ff"
    $g.FillEllipse($moonBrush, 1200, 92, 150, 150)
    $shade = New-Brush "#271b43"
    $g.FillEllipse($shade, 1165, 78, 150, 150)

    $mountainBack = New-Brush "#18251e"
    $mountainFront = New-Brush "#22372b"
    $g.FillPolygon($mountainBack, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(0, 570),
        [System.Drawing.Point]::new(250, 340),
        [System.Drawing.Point]::new(470, 580)
    ))
    $g.FillPolygon($mountainBack, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(360, 590),
        [System.Drawing.Point]::new(760, 260),
        [System.Drawing.Point]::new(1100, 610)
    ))
    $g.FillPolygon($mountainBack, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(900, 600),
        [System.Drawing.Point]::new(1260, 300),
        [System.Drawing.Point]::new(1600, 610)
    ))
    $g.FillPolygon($mountainFront, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(0, 680),
        [System.Drawing.Point]::new(390, 430),
        [System.Drawing.Point]::new(690, 700)
    ))
    $g.FillPolygon($mountainFront, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(610, 690),
        [System.Drawing.Point]::new(1050, 385),
        [System.Drawing.Point]::new(1600, 710)
    ))

    $ground = New-Brush "#101413"
    $grass = New-Brush "#255d45"
    $dirt = New-Brush "#3a2a1b"
    for ($x = 0; $x -lt $w; $x += 50) {
        $height = 650 + (Get-Random -Minimum -20 -Maximum 36)
        $g.FillRectangle($grass, $x, $height, 54, 48)
        $g.FillRectangle($dirt, $x, $height + 46, 54, $h - $height)
    }
    $g.FillRectangle($ground, 0, 760, $w, 150)

    $portalOuter = New-Brush "#15101f"
    $portalInner = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Rectangle]::new(1120, 470, 170, 250),
        [System.Drawing.ColorTranslator]::FromHtml("#8e55ff"),
        [System.Drawing.ColorTranslator]::FromHtml("#e8a84a"),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $g.FillRectangle($portalOuter, 1090, 440, 230, 310)
    $g.FillRectangle($portalInner, 1130, 480, 150, 240)

    $trunk = New-Brush "#3a2a1b"
    $leaf = New-Brush "#1f5c45"
    for ($x = 80; $x -lt 1500; $x += 180) {
        $base = 650 + (Get-Random -Minimum -25 -Maximum 25)
        $g.FillRectangle($trunk, $x + 34, $base - 80, 24, 90)
        $g.FillPolygon($leaf, [System.Drawing.Point[]]@(
            [System.Drawing.Point]::new($x, $base - 70),
            [System.Drawing.Point]::new($x + 46, $base - 170),
            [System.Drawing.Point]::new($x + 94, $base - 70)
        ))
        $g.FillPolygon($leaf, [System.Drawing.Point[]]@(
            [System.Drawing.Point]::new($x + 8, $base - 125),
            [System.Drawing.Point]::new($x + 46, $base - 220),
            [System.Drawing.Point]::new($x + 84, $base - 125)
        ))
    }

    $dragon = New-Brush "#09080d"
    $dragonGlow = New-Pen "#8e55ff" 5
    $g.FillEllipse($dragon, 760, 250, 170, 80)
    $g.FillPolygon($dragon, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(900, 278),
        [System.Drawing.Point]::new(1030, 220),
        [System.Drawing.Point]::new(980, 300)
    ))
    $g.FillPolygon($dragon, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(790, 285),
        [System.Drawing.Point]::new(480, 155),
        [System.Drawing.Point]::new(640, 410)
    ))
    $g.FillPolygon($dragon, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(845, 285),
        [System.Drawing.Point]::new(1110, 140),
        [System.Drawing.Point]::new(1040, 415)
    ))
    $g.DrawArc($dragonGlow, 740, 220, 330, 140, 188, 134)

    $path = Join-Path $assetDir "hero-nexiscraft.png"
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

function Save-Icon {
    $size = 512
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Rectangle]::new(0, 0, $size, $size),
        [System.Drawing.ColorTranslator]::FromHtml("#8e55ff"),
        [System.Drawing.ColorTranslator]::FromHtml("#101413"),
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )
    $g.FillRectangle($bg, 0, 0, $size, $size)

    $ring = New-Pen "#e8a84a" 12
    $g.DrawEllipse($ring, 58, 58, 396, 396)

    $dragon = New-Brush "#09080d"
    $purple = New-Pen "#d8c4ff" 8
    $g.FillEllipse($dragon, 188, 206, 126, 72)
    $g.FillPolygon($dragon, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(260, 220),
        [System.Drawing.Point]::new(390, 145),
        [System.Drawing.Point]::new(338, 280)
    ))
    $g.FillPolygon($dragon, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(220, 220),
        [System.Drawing.Point]::new(92, 138),
        [System.Drawing.Point]::new(150, 290)
    ))
    $g.FillPolygon($dragon, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(302, 224),
        [System.Drawing.Point]::new(386, 200),
        [System.Drawing.Point]::new(322, 260)
    ))
    $g.DrawArc($purple, 110, 156, 300, 150, 196, 132)

    $font = New-Object System.Drawing.Font("Arial", 62, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Brush "#f4efe3"
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("NC", $font, $textBrush, [System.Drawing.RectangleF]::new(0, 338, $size, 100), $format)

    $path = Join-Path $assetDir "server-icon.png"
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

Save-Hero
Save-Icon
