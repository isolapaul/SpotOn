#!/usr/bin/env bash
# Installs the Firebase iOS app config (macOS): copies GoogleService-Info.plist into the Xcode project
# and registers its REVERSED_CLIENT_ID as the URL scheme Google sign-in returns to.
#   bash mobile/scripts/ios-firebase-config.sh ~/Downloads/GoogleService-Info.plist
set -euo pipefail
src=${1:?usage: ios-firebase-config.sh path/to/GoogleService-Info.plist}
cd "$(dirname "$0")/../ios/App/App"
cp "$src" GoogleService-Info.plist
reversed=$(/usr/libexec/PlistBuddy -c 'Print :REVERSED_CLIENT_ID' GoogleService-Info.plist)
/usr/libexec/PlistBuddy -c "Set :CFBundleURLTypes:0:CFBundleURLSchemes:0 $reversed" Info.plist
echo "GoogleService-Info.plist installed; Google sign-in URL scheme: $reversed"
