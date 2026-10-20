# Pele em Foco — Design system

Fonte única dos tokens: [`tokens.css`](tokens.css). App (`src/styles/app.css`) e e-book (`ebook/src/ebook.css`) importam o mesmo arquivo.

## Princípios

1. **Editorial, não “template de SaaS”.** Muito respiro, serifa nos títulos, poucas cores, nada de gradiente.
2. **Calmo e honesto.** Nada de vermelho de alarme, contagem regressiva ou selo de “mais vendido”. Avisos usam terracota discreto.
3. **Legível no celular primeiro.** Corpo de 16px na web, alvos de toque com no mínimo 44px, contraste AA.
4. **Pele real.** Fotografia (quando houver) com textura natural, sem retoque pesado, sem antes/depois.

## Cores

| Token | Hex | Uso |
|---|---|---|
| `--pf-ivory` | `#F7F4EE` | Fundo principal |
| `--pf-beige` | `#E8DFD2` | Seções alternadas, cartões de apoio |
| `--pf-sage` | `#A8B5A0` | Detalhes, anéis do logo, sublinhados. **Não usar para texto** em fundo claro (contraste insuficiente) |
| `--pf-sage-ink` | `#5D6D55` | Versão de sage para texto pequeno (eyebrows, marcadores) |
| `--pf-forest` | `#263D32` | Títulos, botões primários, blocos de destaque |
| `--pf-charcoal` | `#292B29` | Texto de corpo |
| `--pf-muted` | `#5F625D` | Texto secundário |
| `--pf-alert` / `--pf-alert-soft` | `#8A4B2F` / `#F4E6DC` | Avisos e cuidados |

Contraste (aprox.): charcoal sobre ivory ≈ 13:1 · forest sobre ivory ≈ 10:1 · muted sobre ivory ≈ 5,9:1 · ivory sobre forest ≈ 10:1.

## Tipografia

- **Títulos:** Fraunces (variável, eixo óptico), peso 400–500, itálico como acento (“*em foco*”).
- **Corpo e interface:** Inter (variável), 400/500/600.
- Fontes auto-hospedadas via `@fontsource-variable/*` (sem Google Fonts em produção nem no PDF).

| Token | Tamanho | Uso |
|---|---|---|
| `--text-3xl` | 36–60px fluido | Título da página de vendas |
| `--text-2xl` | 36px | H1 do app |
| `--text-xl` | 28px | H2 |
| `--text-lg` | 22px | H3 / títulos de cartão |
| `--text-base` | 16px | Corpo |
| `--text-sm` / `--text-xs` | 14 / 12px | Apoio, legendas |

## Espaçamento e superfícies

Escala de 4px (`--space-1` … `--space-9`). Raios: 6px (campos), 12px (cartões), pílula (botões e chips). Sombras quase imperceptíveis (`--shadow-sm`, `--shadow-md`); bordas de 1px em `--pf-beige-line` fazem a maior parte do trabalho.

## Componentes (classes em `src/styles/app.css`)

| Componente | Classe | Notas |
|---|---|---|
| Botão primário / secundário / fantasma / perigo | `.btn .btn-primary` etc. | Altura mínima 44px (`.btn-lg` 52px) |
| Cartão | `.card`, `.card-flat`, `.card-sage`, `.card-beige`, `.card-forest` | |
| Aviso | `.notice`, `.notice.alert`, `.notice.config` | `.config` = pendência de lançamento (tracejado amarelo, proposital) |
| Chip alternável | `.chip[aria-pressed]` | Hábitos e etiquetas do diário |
| Opção (radio estilizado) | `.option-grid > .option` | |
| Interruptor | `.switch` com `role="switch"` | |
| Checklist | `.checklist .check[role=checkbox]` | |
| Abas | `.tabs [role=tab]` | |
| Perguntas | `details.faq` | |

## Ícones

`lucide-react`, traço 2px (2.2 no item ativo), 18–22px. Sempre `aria-hidden` quando acompanham texto.

## Responsivo

- Mobile primeiro; *gutter* de 16px (32px a partir de 768px).
- App: barra de navegação inferior até 899px; navegação no cabeçalho a partir de 900px.
- Grades: 1 coluna → 2 (640px) → 3 (900px+).
- Container máximo de 72rem; textos longos em 42rem (`.narrow`).

## Logo

Três anéis concêntricos em sage com ponto central forest (o “foco”) + “Pele *em foco*” em Fraunces. Arquivos: `src/components/Brand.tsx`, `public/favicon.svg`, capa em `ebook/assets/cover.svg`.

## Imagens

A capa usa arte vetorial abstrata (anéis + folha). **Não há fotografias no projeto.** Se forem adicionadas: banco de imagens licenciado ou ensaio próprio, pele com textura natural, diversidade de tons de pele e gêneros, sem antes/depois e sem imagens geradas por IA apresentadas como pessoas reais.
