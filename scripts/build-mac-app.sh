#!/bin/zsh
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="DLR Signalling Sim.app"
APP_DIR="$REPO_DIR/$APP_NAME"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

release_version=$(node -p "require(process.argv[1]).version" "$REPO_DIR/package.json")
# 1. Create Info.plist
cat > "$CONTENTS_DIR/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>DLR Signalling Sim</string>
  <key>CFBundleExecutable</key>
  <string>dlr-sim-launcher</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>uk.gov.tfl.dlr.signalling-sim</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>DLR Signalling Sim</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$release_version</string>
  <key>CFBundleVersion</key>
  <string>$release_version</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
EOF

# Keep the bundle in place so an existing Dock bookmark stays valid.
cat > "$MACOS_DIR/dlr-sim-launcher" << 'EOF'
#!/bin/zsh
set -eu
repo_dir=${0:A:h:h:h:h}
EOF
printf 'if [[ ! -f "$repo_dir/scripts/launch-mac.mjs" ]]; then repo_dir=%q; fi\n' "$REPO_DIR" >> "$MACOS_DIR/dlr-sim-launcher"
cat >> "$MACOS_DIR/dlr-sim-launcher" << 'EOF'
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
node_bins=("$HOME"/.nvm/versions/node/*/bin(Nn))
if (( ${#node_bins} )); then export PATH="${node_bins[-1]}:$PATH"; fi
if ! cd "$repo_dir" || [[ ! -f scripts/launch-mac.mjs ]]; then
  osascript -e 'display alert "DLR Signalling Sim" message "Open the app in the signal-dlr-sim project folder."'
  exit 1
fi
if ! command -v node >/dev/null; then
  osascript -e 'display alert "DLR Signalling Sim" message "The simulator needs Node.js to start its local server."'
  exit 1
fi
exec node scripts/launch-mac.mjs
EOF

chmod +x "$MACOS_DIR/dlr-sim-launcher"

# 3. Generate a custom DLR Roundel macOS AppIcon.icns using Python & iconutil
ICONSET_DIR="/tmp/DLRSimIcon.iconset"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

python3 - << 'PYEOF'
import os, struct, zlib, math

def make_dlr_icon_png(filename, size=512):
    w = h = size
    cx = cy = size / 2.0
    pixels = bytearray()

    for y in range(h):
        pixels.append(0) # filter byte
        for x in range(w):
            # Rounded square background (#070B10 obsidian with #00A4A7 border glow)
            margin = size * 0.06
            rx = max(0.0, abs(x - cx) - (size / 2.0 - margin - size * 0.16))
            ry = max(0.0, abs(y - cy) - (size / 2.0 - margin - size * 0.16))
            corner_d = math.hypot(rx, ry)
            if corner_d > size * 0.16:
                pixels.extend((0, 0, 0, 0))
                continue

            r, g, b, a = 11, 17, 26, 255
            dist = math.hypot(x - cx, y - cy)

            # DLR Teal Roundel Ring (#00A4A7)
            outer_r = size * 0.34
            inner_r = size * 0.21
            if inner_r <= dist <= outer_r:
                r, g, b = 0, 164, 167

            # Horizontal Navy Bar across the center (#003B49 with #F59E0B gold pin-stripes)
            bar_half_w = size * 0.41
            bar_half_h = size * 0.085
            if abs(x - cx) <= bar_half_w and abs(y - cy) <= bar_half_h:
                if abs(abs(y - cy) - bar_half_h) < size * 0.015:
                    r, g, b = 245, 158, 11 # Solari Amber border
                else:
                    r, g, b = 0, 59, 73    # DLR Deep Teal/Navy bar

            pixels.extend((r, g, b, a))

    def png_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack("!I", len(data)) + chunk + struct.pack("!I", zlib.crc32(chunk) & 0xffffffff)

    ihdr = struct.pack("!IIBBBBB", w, h, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(pixels), 6)
    with open(filename, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(png_chunk(b"IHDR", ihdr))
        f.write(png_chunk(b"IDAT", idat))
        f.write(png_chunk(b"IEND", b""))

base_png = "/tmp/DLRSimIcon_512.png"
make_dlr_icon_png(base_png, 512)
PYEOF

for sz in 16 32 128 256 512; do
  sips -z $sz $sz /tmp/DLRSimIcon_512.png --out "$ICONSET_DIR/icon_${sz}x${sz}.png" >/dev/null 2>&1
  sz2=$((sz * 2))
  sips -z $sz2 $sz2 /tmp/DLRSimIcon_512.png --out "$ICONSET_DIR/icon_${sz}x${sz}@2x.png" >/dev/null 2>&1
done

iconutil -c icns "$ICONSET_DIR" -o "$RESOURCES_DIR/AppIcon.icns"
rm -rf "$ICONSET_DIR" /tmp/DLRSimIcon_512.png

echo "Built macOS App Bundle at: $APP_DIR"
