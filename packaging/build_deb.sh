#!/bin/bash
# build_deb.sh — Baut das Debian-Paket für Qlog-Tools.
#
# Aufruf: ./packaging/build_deb.sh
# Ausgabe: packaging/qlog-tools_0.4.3_amd64.deb
#
# Voraussetzungen: dpkg-deb, python3, python3-venv

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEB_ROOT="$SCRIPT_DIR/debian"
APP_DEST="$DEB_ROOT/opt/qlog-tools/app"
VERSION="0.4.3"
ARCH="amd64"
PACKAGE="qlog-tools_${VERSION}_${ARCH}"

echo "=== Qlog-Tools DEB-Build v${VERSION} ==="

# ── 1. Quellcode ins Paket-Verzeichnis kopieren ───────────────────────────────
echo "→ Kopiere Quellcode..."
rm -rf "$APP_DEST"
mkdir -p "$APP_DEST"

# Nur relevante Dateien — keine __pycache__, .git, docs, config.ini, packaging
rsync -a --delete \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='config.ini' \
  --exclude='packaging/' \
  --exclude='docs/' \
  --exclude='.git' \
  --exclude='.claude' \
  --exclude='.gitignore' \
  --exclude='CLAUDE.md' \
  --exclude='*.adif' \
  "$PROJECT_DIR/" "$APP_DEST/"

# ── 2. Berechtigungen setzen ──────────────────────────────────────────────────
echo "→ Setze Berechtigungen..."

# DEBIAN-Scripts müssen ausführbar sein
chmod 755 "$DEB_ROOT/DEBIAN/postinst"
chmod 755 "$DEB_ROOT/DEBIAN/prerm"

# Starter-Script ausführbar
chmod 755 "$DEB_ROOT/usr/local/bin/qlog-tools"

# App-Dateien: Verzeichnisse 755, Dateien 644
find "$APP_DEST" -type d -exec chmod 755 {} \;
find "$APP_DEST" -type f -exec chmod 644 {} \;

# ── 3. DEB bauen ──────────────────────────────────────────────────────────────
echo "→ Baue DEB-Paket..."
OUTPUT="$SCRIPT_DIR/${PACKAGE}.deb"
dpkg-deb --build --root-owner-group "$DEB_ROOT" "$OUTPUT"

echo ""
echo "✓ Fertig: $OUTPUT"
echo ""
echo "Installation:    sudo dpkg -i $OUTPUT"
echo "Deinstallation:  sudo apt remove qlog-tools"
