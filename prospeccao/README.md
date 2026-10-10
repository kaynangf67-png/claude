# Prospecção: negócios sem site

1. Na Apify, rode o **Google Maps Scraper** (`compass/crawler-google-places`) com `input-apify.json`.
   Troque `locationQuery` para cobrir Vila Velha, Vitória e Cariacica (uma cidade por execução).
   Custo aproximado: US$ 0,004 por lugar, ou seja ~US$ 2 por cidade com esta lista.
2. Exporte o dataset em JSON e rode:

```bash
node prospeccao/rank.mjs dataset.json leads-sem-site.csv
```

O script mostra, por nicho, quantos negócios existem, a % sem site próprio e quantos são leads
qualificados, e gera um CSV ordenado por número de avaliações.

- **Sem site próprio** = sem link, ou link que é só Instagram, WhatsApp, Linktree, Google Sites, iFood etc.
- **Qualificado** = sem site próprio, com telefone, nota ≥ 4,0 e ≥ 10 avaliações (negócio ativo e com clientela).

Os CSVs e datasets têm telefones de terceiros e ficam fora do git (`.gitignore`).
