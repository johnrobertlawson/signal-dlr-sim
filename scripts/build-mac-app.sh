#!/bin/zsh
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="DLR Signalling Sim.app"
APP_DIR="$REPO_DIR/$APP_NAME"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

# 1. Create Info.plist
cat > "$CONTENTS_DIR/Info.plist" << 'EOF'
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
  <string>1.1.0</string>
  <key>CFBundleVersion</key>
  <string>2</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
EOF

# 2. Create the MacOS Launcher Script (starts server, opens chromeless app window, kills server on close)
cat > "$MACOS_DIR/dlr-sim-launcher" << EOF
#!/bin/zsh

# Ensure Node/NVM and Homebrew are on PATH when launched from Finder/Dock
export NVM_DIR="\$HOME/.nvm"
if [ -d "\$NVM_DIR/versions/node" ]; then
  LATEST_NODE_BIN=\$(ls -d "\$NVM_DIR/versions/node"/*/bin 2>/dev/null | tail -n 1)
  if [ -n "\$LATEST_NODE_BIN" ]; then
    export PATH="\$LATEST_NODE_BIN:\$PATH"
  fi
fi
export PATH="/opt/homebrew/bin:/usr/local/bin:\$PATH"

REPO_DIR="$REPO_DIR"
cd "\$REPO_DIR" || exit 1

# Pick port 5173 (or next free port if 5173 is already in use)
PORT=5173
while lsof -Pi :\$PORT -sTCP:LISTEN -t >/dev/null 2>&1; do
  PORT=\$((PORT + 1))
done

SERVER_PID=""
APP_PROFILE_DIR="/tmp/dlr-signalling-sim-chrome-profile"

cleanup() {
  if [ -n "\$SERVER_PID" ] && kill -0 "\$SERVER_PID" 2>/dev/null; then
    kill "\$SERVER_PID" 2>/dev/null || true
    wait "\$SERVER_PID" 2>/dev/null || true
  fi
  # Ensure any child process bound to PORT is terminated cleanly
  local leftover_pids=\$(lsof -ti tcp:\$PORT 2>/dev/null)
  if [ -n "\$leftover_pids" ]; then
    kill \$leftover_pids 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM HUP QUIT

# Start Vite server in background
./node_modules/.bin/vite --host 127.0.0.1 --port "\$PORT" --strictPort > /tmp/dlr-sim-server.log 2>&1 &
SERVER_PID=\$!

# Wait until the server responds (typically < 250ms)
for i in {1..40}; do
  if curl -sf "http://127.0.0.1:\$PORT" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

URL="http://127.0.0.1:\$PORT"

# Launch dedicated chromeless App Window and block until the user closes the window
if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\
    --app="\$URL" \\
    --user-data-dir="\$APP_PROFILE_DIR" \\
    --window-size=1640,980 \\
    --no-first-run \\
    --no-default-browser-check \\
    --disable-features=Translate >/dev/null 2>&1
elif [ -x "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" ]; then
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \\
    --app="\$URL" \\
    --user-data-dir="\$APP_PROFILE_DIR" \\
    --window-size=1640,980 \\
    --no-first-run >/dev/null 2>&1
else
  open -W "\$URL"
fi
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
