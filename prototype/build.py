"""Inline prototype/shared/real3d.js into the pages that use it.

The artifact pages must be single files, so the shared 3D kit is copied in
between the /*REAL3D-START*/ and /*REAL3D-END*/ markers. Run after editing
real3d.js:  python3 prototype/build.py
"""
import pathlib
import re

root = pathlib.Path(__file__).parent
kit = (root / "shared" / "real3d.js").read_text(encoding="utf-8")
pattern = re.compile(r"/\*REAL3D-START\*/.*?/\*REAL3D-END\*/", re.S)
for page in ["kaiju3d/index.html", "kaiju/index.html"]:
    path = root / page
    html = path.read_text(encoding="utf-8")
    if "/*REAL3D-START*/" not in html:
        continue
    html = pattern.sub(lambda _: "/*REAL3D-START*/\n" + kit + "\n/*REAL3D-END*/", html)
    path.write_text(html, encoding="utf-8")
    print("updated", page)
