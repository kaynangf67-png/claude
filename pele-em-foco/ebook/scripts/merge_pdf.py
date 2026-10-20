"""Troca a primeira e a última página do miolo pela capa e pela contracapa.

Uso: merge_pdf.py miolo.pdf capa.pdf contracapa.pdf saida.pdf '[["Título", 4], ...]'
"""
import json
import sys

from pypdf import PdfReader, PdfWriter

body_path, cover_path, back_path, out_path, bookmarks_json = sys.argv[1:6]
body = PdfReader(body_path)
writer = PdfWriter()
writer.add_page(PdfReader(cover_path).pages[0])
for page in body.pages[1:-1]:
    writer.add_page(page)
writer.add_page(PdfReader(back_path).pages[0])

writer.add_metadata({
    "/Title": "Pele em Foco — Guia prático para entender a acne e organizar sua rotina de cuidados",
    "/Author": "Pele em Foco",
    "/Subject": "Guia educativo sobre acne e rotina de cuidados com a pele",
})
# Marcadores (bookmarks): lista JSON de [título, página iniciando em 1].
for title, page_number in json.loads(bookmarks_json):
    writer.add_outline_item(title, page_number - 1)

with open(out_path, "wb") as fh:
    writer.write(fh)
