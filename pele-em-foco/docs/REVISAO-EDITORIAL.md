# Checklist de revisão editorial — e-book e app

Use antes de cada nova edição do PDF ou publicação de conteúdo no app.

## Segurança do conteúdo

- [x] Não promete cura, “pele perfeita”, transformação garantida nem resultado em prazo fixo.
- [x] Não diagnostica, não indica tratamento individual, não recomenda medicamento de prescrição.
- [x] Retinoides citados como medicamentos sob prescrição no Brasil, com alerta para gestação.
- [x] Proíbe explicitamente limão, pasta de dente, bicarbonato, óleos essenciais puros e esfoliantes caseiros abrasivos.
- [x] Alimentação: sem dieta restritiva, sem alimento/chá/detox/suplemento como cura; evidência apresentada com limitações; indicação do Guia Alimentar do Ministério da Saúde.
- [x] Acne persistente, dolorosa, grave ou com cicatriz → avaliação profissional (cap. 9, app, página de vendas).
- [x] Sinais de urgência (inchaço importante, febre, reação alérgica, falta de ar).
- [x] Plano de 30 dias descrito como organização de hábitos, não promessa clínica.
- [x] Sem depoimentos, antes/depois, números de clientes ou endossos de especialistas.
- [x] Ingredientes descritos de forma geral, com limitações e riscos de irritação.
- [x] Nenhum produto ou marca recomendada; nenhum preço inventado.
- [x] Linguagem inclusiva (homens e mulheres; “o(a)”), sem explorar insegurança.
- [x] Aspecto emocional da acne reconhecido, com indicação de apoio profissional.

## Evidência

- [x] Todas as afirmações de saúde rastreáveis a uma fonte da lista (cap. 12 / `docs/FONTES.md`).
- [ ] **Links abertos e conferidos manualmente num navegador comum** (ver aviso em `docs/FONTES.md`).
- [ ] **Revisão técnica por médico(a) dermatologista** (CRM + RQE). Preencher `ebook/config.json → technicalReviewer` e regenerar o PDF. Enquanto vazio, o PDF declara que não houve revisão técnica.
- [x] Força das recomendações da diretriz AAD 2024 descrita como “forte”/“condicional”, sem exagero.
- [x] Estudos de dieta apresentados com desenho e limitação (observacional; fator de confusão).

## Forma

- [x] Sumário com números de página reais (gerados no build).
- [x] Marcadores (bookmarks) no PDF.
- [x] Capa, créditos, aviso legal, glossário, página do app, contracapa.
- [x] Checklists, ficha para consulta, planilha de comparação, registro de 30 dias imprimível.
- [x] PDF aberto e todas as 53 páginas inspecionadas visualmente (build de 20/10/2026).
- [ ] Revisão ortográfica humana completa.
- [ ] Teste de leitura em celular real (iOS e Android) e impressão de uma página de teste.

## Antes de vender

- [ ] `ebook/config.json` preenchido (autor, revisor, suporte, URL do app, data do bônus) e PDF regenerado (`npm run ebook:pdf`).
- [ ] Amostras da página de vendas regeneradas se a paginação mudou (`npm run ebook:samples`).
- [ ] Conferir as políticas da plataforma de pagamento para produtos de saúde/beleza.
