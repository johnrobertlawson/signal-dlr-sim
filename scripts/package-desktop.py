"""Build a universal macOS installer on macOS, or Ubuntu packages on Debian/Ubuntu."""
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text())['version']
APP = 'DLR Signalling Sim.app'
OUT = ROOT / 'release'
OUT.mkdir(exist_ok=True)


def run(*args, **kwargs):
    subprocess.run(args, check=True, **kwargs)


def build_exe(stage, dest, system, arch):
    dest.parent.mkdir(parents=True, exist_ok=True)
    run('go', 'build', '-trimpath', '-ldflags=-s -w', '-o', dest, 'main.go', cwd=stage,
        env={**os.environ, 'GOOS': system, 'GOARCH': arch, 'CGO_ENABLED': '0'})


def mac(stage):
    app = stage / 'payload' / APP
    contents = app / 'Contents'
    (contents / 'MacOS').mkdir(parents=True)
    shutil.copytree(ROOT / APP / 'Contents/Resources', contents / 'Resources')
    with (ROOT / APP / 'Contents/Info.plist').open('rb') as f:
        info = plistlib.load(f)
    info.update(CFBundleIdentifier='io.github.johnrobertlawson.dlr-sim', CFBundleVersion=VERSION,
                CFBundleShortVersionString=VERSION, LSMinimumSystemVersion='13.0')
    (contents / 'Info.plist').write_bytes(plistlib.dumps(info))
    for arch in ['arm64', 'amd64']:
        build_exe(stage, stage / arch, 'darwin', arch)
    run('lipo', '-create', stage / 'amd64', stage / 'arm64', '-output', contents / 'MacOS' / info['CFBundleExecutable'])
    run('codesign', '--force', '--sign', '-', app)
    run('codesign', '--verify', '--strict', app)
    # Prevent Installer from relocating an upgrade into a source checkout.
    components = stage / 'components.plist'
    run('pkgbuild', '--analyze', '--root', stage / 'payload', components)
    specs = plistlib.loads(components.read_bytes())
    for spec in specs:
        spec['BundleIsRelocatable'] = False
    components.write_bytes(plistlib.dumps(specs))
    run('pkgbuild', '--root', stage / 'payload', '--component-plist', components,
        '--ownership', 'recommended', '--install-location', '/Applications',
        '--identifier', info['CFBundleIdentifier'], '--version', VERSION,
        OUT / f'DLR-Signalling-Sim-{VERSION}-macOS-universal.pkg')


def ubuntu(stage):
    for arch in ['amd64', 'arm64']:
        pkg = stage / arch
        build_exe(stage, pkg / 'usr/bin/dlr-signalling-sim', 'linux', arch)
        desktop = pkg / 'usr/share/applications'
        desktop.mkdir(parents=True)
        shutil.copy(ROOT / 'desktop/dlr-signalling-sim.desktop', desktop)
        icons = pkg / 'usr/share/icons/hicolor/512x512/apps'
        icons.mkdir(parents=True)
        shutil.copy(ROOT / 'desktop/dlr-signalling-sim.png', icons)
        control = pkg / 'DEBIAN/control'
        control.parent.mkdir()
        control.write_text(f'''Package: dlr-signalling-sim
Version: {VERSION}
Architecture: {arch}
Section: games
Priority: optional
Maintainer: John Lawson <john.lawson@usu.edu>
Depends: xdg-utils, firefox | chromium-browser | google-chrome-stable | firefox-esr | chromium
Description: Docklands Light Railway signalling simulator for the graphical desktop
 Control trains and airport traffic from a local simulator window.
''')
        run('dpkg-deb', '--root-owner-group', '--build', pkg, OUT / f'dlr-signalling-sim_{VERSION}_{arch}.deb')


if __name__ == '__main__':
    run('npm', 'run', 'build', cwd=ROOT)
    with tempfile.TemporaryDirectory(prefix='dlr-desktop-') as tmp:
        stage = Path(tmp)
        shutil.copy(ROOT / 'desktop/main.go', stage)
        shutil.copytree(ROOT / 'dist', stage / 'dist')
        index = stage / 'dist/index.html'
        index.write_text(index.read_text().replace('<head>', '<head><meta name="dlr-desktop" content="installed">'))
        (mac if sys.platform == 'darwin' else ubuntu)(stage)
