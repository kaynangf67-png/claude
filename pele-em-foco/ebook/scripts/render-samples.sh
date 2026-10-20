#!/usr/bin/env sh
# Exporta páginas de amostra do PDF para a página de vendas (public/amostras).
# Uso: npm run ebook:samples   (requer poppler-utils: pdftoppm)
set -e
cd "$(dirname "$0")/../.."
PDF=ebook/dist/pele-em-foco.pdf
OUT=public/amostras
mkdir -p "$OUT"
# página:nome — ajuste se a paginação mudar (veja o sumário do PDF)
for spec in 3:sumario 8:como-a-acne-se-forma 19:como-ler-um-rotulo 42:registro-30-dias; do
  page=${spec%%:*}; name=${spec#*:}
  pdftoppm -r 110 -png -singlefile -f "$page" -l "$page" "$PDF" "$OUT/$name"
done
ls -la "$OUT"
