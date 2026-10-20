"""Localiza a página de cada marcador de capítulo (§cap1, §glossario...) num PDF."""
import json
import re
import sys

from pypdf import PdfReader

reader = PdfReader(sys.argv[1])
found = {}
for index, page in enumerate(reader.pages):
    for key in re.findall(r"§(cap\d+|glossario|app)", page.extract_text() or ""):
        found.setdefault(key, index + 1)
print(json.dumps({"pages": found, "total": len(reader.pages)}))
