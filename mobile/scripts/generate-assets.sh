#!/usr/bin/env bash
# Regenerates the native app icons and splash images from the PWA icons in public/ (ImageMagick 6 or 7).
# The outputs are committed; run this only when the icons change: bash mobile/scripts/generate-assets.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

IM=convert
command -v magick >/dev/null 2>&1 && IM=magick

MASKABLE=public/icon-maskable-512x512.png   # full-bleed green square with the pin (launcher icons)
SPLASH_BG='#0E1013'                         # the app's background (manifest background_color)
RES=mobile/android/app/src/main/res
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# The splash icon: the maskable icon with rounded corners (the PWA icon has an opaque square background).
ICON="$TMP/rounded.png"
$IM "$MASKABLE" \( -size 512x512 xc:none -fill white -draw "roundrectangle 0,0 511,511 112,112" \) \
  -compose CopyOpacity -composite "$ICON"

# Android launcher icons: legacy square + round, and the adaptive foreground (108dp canvas; the pin
# stays inside the 66dp safe zone because the maskable icon keeps it within its central 40 %).
for pair in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  d=${pair%%:*}; s=${pair##*:}
  fg=$(( s * 108 / 48 ))
  $IM "$MASKABLE" -resize "${s}x${s}" "$RES/mipmap-$d/ic_launcher.png"
  $IM "$MASKABLE" -resize "${s}x${s}" \
    \( -size "${s}x${s}" xc:none -fill white -draw "circle $((s/2)),$((s/2)) $((s/2)),0" \) \
    -compose CopyOpacity -composite "$RES/mipmap-$d/ic_launcher_round.png"
  $IM "$MASKABLE" -resize "${fg}x${fg}" "$RES/mipmap-$d/ic_launcher_foreground.png"
done

# Android splash drawables (pre-Android 12 launch background): the icon centred on the app background.
for f in "$RES"/drawable*/splash.png; do
  size=$($IM identify -format '%wx%h' "$f" 2>/dev/null || identify -format '%wx%h' "$f")
  w=${size%x*}; h=${size#*x}
  m=$(( (w < h ? w : h) * 30 / 100 ))
  $IM -size "${w}x${h}" "xc:$SPLASH_BG" \( "$ICON" -resize "${m}x${m}" \) -gravity center -composite "$f"
done

# iOS: the single 1024 px app icon (no transparency allowed) and the launch screen image.
IOS=mobile/ios/App/App/Assets.xcassets
$IM "$MASKABLE" -resize 1024x1024 -background '#16A064' -alpha remove -alpha off "$IOS/AppIcon.appiconset/AppIcon-512@2x.png"
for f in "$IOS"/Splash.imageset/splash-2732x2732*.png; do
  $IM -size 2732x2732 "xc:$SPLASH_BG" \( "$ICON" -resize 560x560 \) -gravity center -composite "$f"
done
echo "Native icons and splash images regenerated."
