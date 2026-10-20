// Fontes citadas no app e no e-book. Conferidas em 20/10/2026 (veja docs/FONTES.md).
export interface Source {
  label: string;
  url: string;
}

export const SOURCES = {
  aadTips: { label: 'AAD — Acne: Tips for managing', url: 'https://www.aad.org/public/diseases/acne/skin-care/tips' },
  aadHabits: { label: 'AAD — 10 skin care habits that can worsen acne', url: 'https://www.aad.org/public/diseases/acne/skin-care/habits-stop' },
  aadTypes: { label: 'AAD — How to treat different types of acne', url: 'https://www.aad.org/public/diseases/acne/diy/types-breakouts' },
  aadTreat: { label: 'AAD — Acne: Diagnosis and treatment', url: 'https://www.aad.org/public/diseases/acne/derm-treat/treat' },
  aadDiet: { label: 'AAD — Can the right diet get rid of acne?', url: 'https://www.aad.org/public/diseases/acne/causes/diet' },
  aadScars: { label: 'AAD — Acne scars: Causes', url: 'https://www.aad.org/public/diseases/acne/derm-treat/scars/causes' },
  aadWash: { label: 'AAD — Face washing 101', url: 'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101' },
  aadOily: { label: 'AAD — How to control oily skin', url: 'https://www.aad.org/public/everyday-care/skin-care-basics/dry/oily-skin' },
  aadSunscreen: { label: 'AAD — Sunscreen FAQs', url: 'https://www.aad.org/sun-protection/sunscreen-faqs' },
  sbdAcne: { label: 'SBD — Acne: cuidados com a pele, como prevenir e tratamentos', url: 'https://www.sbd.org.br/doencas/acne/' },
  sbdTreat: { label: 'SBD — Tratamento da acne', url: 'https://www.sbd.org.br/tratamentos/tratamento-da-acne/' },
  msAcne: { label: 'Ministério da Saúde (BVS) — Acne', url: 'https://bvsms.saude.gov.br/acne/' },
  msGuia: { label: 'Ministério da Saúde — Guia alimentar para a população brasileira', url: 'https://bvsms.saude.gov.br/bvs/publicacoes/guia_alimentar_populacao_brasileira_2ed.pdf' },
  anvisaInci: { label: 'Anvisa — Perguntas frequentes: RDC nº 646/2022 (rotulagem de ingredientes)', url: 'https://www.gov.br/anvisa/pt-br/acessoainformacao/perguntasfrequentes/cosmeticos/rdc-no-646-2022' },
  guideline2024: { label: 'Reynolds RV et al. Guidelines of care for the management of acne vulgaris. J Am Acad Dermatol, 2024', url: 'https://doi.org/10.1016/j.jaad.2023.12.017' },
  dietReview: { label: 'Meixiong J et al. Diet and acne: a systematic review. JAAD Int, 2022', url: 'https://pubmed.ncbi.nlm.nih.gov/35373155/' },
  dairyMeta: { label: 'Juhl CR et al. Dairy intake and acne vulgaris: meta-analysis. Nutrients, 2018', url: 'https://pubmed.ncbi.nlm.nih.gov/30096883/' },
  lowGlycemic: { label: 'Smith RN et al. A low-glycemic-load diet improves symptoms in acne vulgaris patients. Am J Clin Nutr, 2007', url: 'https://pubmed.ncbi.nlm.nih.gov/17616769/' },
} satisfies Record<string, Source>;
