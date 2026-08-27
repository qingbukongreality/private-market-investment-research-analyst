#!/bin/zsh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_APP="$PROJECT_DIR/node_modules/electron/dist/Electron.app"
OUTPUT_DIR="$PROJECT_DIR/mac-app"
OUTPUT_APP="$OUTPUT_DIR/投研项目工作台.app"

if [[ ! -d "$ELECTRON_APP" ]]; then
  echo "Electron runtime is missing."
  exit 1
fi
if [[ -e "$OUTPUT_APP" ]]; then
  echo "Output already exists: $OUTPUT_APP"
  exit 2
fi

mkdir -p "$OUTPUT_DIR"
cp -R "$ELECTRON_APP" "$OUTPUT_APP"
mkdir -p "$OUTPUT_APP/Contents/Resources/app/desktop"
cp "$PROJECT_DIR/desktop/main.cjs" "$OUTPUT_APP/Contents/Resources/app/desktop/main.cjs"
cp "$PROJECT_DIR/desktop/preload.cjs" "$OUTPUT_APP/Contents/Resources/app/desktop/preload.cjs"
cp "$PROJECT_DIR/local-server.mjs" "$OUTPUT_APP/Contents/Resources/app/local-server.mjs"
cp -R "$PROJECT_DIR/desktop-dist" "$OUTPUT_APP/Contents/Resources/app/desktop-dist"
cp -R "$PROJECT_DIR/embedded-skills" "$OUTPUT_APP/Contents/Resources/app/embedded-skills"
cp -R "$PROJECT_DIR/tools" "$OUTPUT_APP/Contents/Resources/app/tools"
cp -R "$PROJECT_DIR/vendor" "$OUTPUT_APP/Contents/Resources/app/vendor"
cp "$PROJECT_DIR/package.json" "$OUTPUT_APP/Contents/Resources/app/package.json"

mv "$OUTPUT_APP/Contents/MacOS/Electron" "$OUTPUT_APP/Contents/MacOS/FengYuanWorkbench"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable FengYuanWorkbench" "$OUTPUT_APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.fengyuan.dealflow" "$OUTPUT_APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName 投研项目工作台" "$OUTPUT_APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName 投研项目工作台" "$OUTPUT_APP/Contents/Info.plist"
/usr/bin/codesign --force --deep --sign - "$OUTPUT_APP"

echo "$OUTPUT_APP"
