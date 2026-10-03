#!/usr/bin/env python3
"""Packs Vice Pack BP + RP into one .mcaddon (default: Vice_Pack_vX_Y.mcaddon in the repo root)."""
import json, os, sys, zipfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ver = json.load(open(os.path.join(root, "Vice Pack BP", "manifest.json")))["header"]["version"]
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, f"Vice_Pack_v{ver[0]}_{ver[1]}" + (f"_{ver[2]}" if ver[2] else "") + ".mcaddon")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for pack in ("Vice Pack BP", "Vice Pack RP"):
        for dp, _, files in sorted(os.walk(os.path.join(root, pack))):
            for f in sorted(files):
                full = os.path.join(dp, f)
                if f.endswith(".json"):
                    json.load(open(full))          # refuse to ship broken JSON
                z.write(full, os.path.relpath(full, root))
print(out)
