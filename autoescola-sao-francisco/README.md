# Auto Escola São Francisco: site

Site institucional de página única do Centro de Formação de Condutores Auto Escola São Francisco, em Serra, ES.
Feito com React 19, TypeScript, Vite 8, Tailwind CSS 4 e ícones Lucide. Não tem backend nem formulário: toda a
conversão acontece pelo WhatsApp.

## Rodando

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/ (com checagem de tipos)
npm run preview   # serve dist/ em http://localhost:4173
```

## Publicando

É um site estático. Na Vercel, importe o repositório e defina **Root Directory = `autoescola-sao-francisco`**.
O `vercel.json` já informa o comando de build e a pasta `dist`. Netlify, Cloudflare Pages ou qualquer hospedagem
estática também servem: publique o conteúdo de `dist/`.

Depois de ter o domínio, preencha `siteUrl` em `src/config/site.ts` e rode a build de novo. Isso ativa a URL
canônica, o `og:url` e os dados estruturados (Schema.org `DrivingSchool`) para o Google.

## Onde editar

| O quê | Onde |
|---|---|
| WhatsApp, telefone, Instagram, endereço, horário, link do Maps | `src/config/site.ts` |
| Mensagens pré-preenchidas de cada botão | `messages` em `src/config/site.ts` |
| Categorias A, B e A + B | `categories` em `src/config/site.ts` |
| Cursos profissionalizantes | `courses` em `src/config/site.ts` |
| Perguntas frequentes | `faq` em `src/config/site.ts` |
| Título e descrição para o Google | `seo` em `src/config/site.ts` |
| Fotos | pasta `src/assets/fotos/` (veja abaixo) |

Campo vazio (`''` ou `[]`) significa "não confirmado". O site mostra um marcador `[a confirmar]` no lugar, e os
botões de WhatsApp levam até a seção de contato enquanto o número não existir. Nenhum botão abre uma conversa sem
destino.

## Fotos

O site não usa banco de imagens. Sem foto, cada seção mostra uma composição gráfica própria. Para colocar fotos
reais, salve os arquivos com estes nomes (jpg, png ou webp) e rode a build:

| Arquivo | Onde aparece |
|---|---|
| `src/assets/fotos/hero.jpg` | Primeira dobra (aula prática, carro da autoescola). Vertical ou quadrada. |
| `src/assets/fotos/autoescola.jpg` | Seção "A Autoescola" (fachada, recepção ou equipe). |
| `src/assets/fotos/cursos.jpg` | Seção de cursos. |
| `src/assets/fotos/final.jpg` | Fundo da chamada final (fica escurecida). Horizontal. |
| `src/assets/fotos/aprovados/*.jpg` | Galeria "Cada conquista tem uma história." |

Na galeria, o nome do arquivo vira a legenda: `maria-categoria-b.jpg` aparece como "Maria · Categoria B".
**Só publique foto de aluno com autorização de uso de imagem por escrito.** Prefira arquivos com até 1600 px no
lado maior e menos de 400 KB.

## O que precisa ser confirmado antes de publicar

O site de referência (cnh-gen-flow.lovable.app) não pôde ser lido durante o desenvolvimento. As informações abaixo
vieram de diretórios públicos ou ainda não existem:

1. **Número do WhatsApp.** Sem ele, nenhum botão abre conversa. É o item mais importante.
2. **Telefone fixo.** Diretórios listam (27) 3328-1558 (Solutudo, serra-es.com) e outro lista (27) 3328-2000.
3. **Horário de atendimento.** Diretórios divergem (8h–18h e 9h–18h de segunda a sexta; fechado no fim de semana).
4. **Instagram** (o @ exato).
5. **Endereço**: Av. Eldes Scherrer Souza, 1345, Parque Residencial Laranjeiras, Serra – ES, CEP 29165-680.
   Confirmado por mais de um diretório, mas vale conferir. Se a autoescola tiver ficha no Google Maps, cole o link
   em `address.mapsUrl`.
6. **Cursos profissionalizantes**: nomes e descrições reais. Hoje aparecem 4 marcadores.
7. **Fotos**: hero, autoescola e alunos aprovados (com autorização).
8. **Política de privacidade**: o link no rodapé só aparece quando `privacyPolicyUrl` for preenchido.
9. **Texto do FAQ sobre a Resolução Contran nº 1.020/2025** (fim da obrigatoriedade das aulas em autoescola).
   Revise com a equipe como a autoescola quer se posicionar.

## Decisões de conteúdo

- Nenhum preço, prazo, taxa, depoimento, nota, estatística ou promessa de aprovação. O texto diz explicitamente
  que prazos dependem do Detran-ES e que a aprovação depende do candidato.
- O FAQ não afirma que a autoescola é obrigatória. Desde a Resolução Contran nº 1.020/2025 ela não é, e o site
  apresenta a autoescola como escolha por preparo e acompanhamento.
- Acessibilidade: link "pular para o conteúdo", menu móvel com `aria-expanded` que fecha com Esc e devolve o foco,
  acordeão com `aria-controls`, foco visível, animações desligadas com `prefers-reduced-motion`.
