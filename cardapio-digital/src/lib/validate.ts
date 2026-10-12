import type { MenuConfig } from '../types/menu.ts';
import { isPublishable } from './menu.ts';
import { contrastRatio, FONT_PRESETS, HEX_COLOR } from './theme.ts';

export type Severity = 'erro' | 'bloqueia-publicacao' | 'aviso';

export interface Issue {
  severity: Severity;
  field: string;
  message: string;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Valida a configuração.
 * - 'erro': quebra o site; o build falha.
 * - 'bloqueia-publicacao': o site funciona, mas não pode ir ao ar (`npm run check:publish`).
 * - 'aviso': melhoria recomendada.
 *
 * `fileExists` recebe caminhos relativos a public/.
 */
export function validateMenu(config: MenuConfig, fileExists: (path: string) => boolean): Issue[] {
  const issues: Issue[] = [];
  const add = (severity: Severity, field: string, message: string) =>
    issues.push({ severity, field, message });
  const r = config.restaurant;

  const checkImage = (field: string, path: string | undefined) => {
    if (!path) return;
    if (/^https?:\/\//.test(path)) return;
    if (path.startsWith('/')) add('erro', field, `use o caminho sem barra inicial: "${path.slice(1)}"`);
    else if (!fileExists(path)) add('erro', field, `arquivo não encontrado em public/${path}`);
  };

  // Restaurante
  if (config.demo) add('bloqueia-publicacao', 'demo', 'configuração ainda está em modo demonstração');
  if (!r.name.trim()) add('erro', 'restaurant.name', 'nome do restaurante vazio');
  if (!r.publicUrl) add('bloqueia-publicacao', 'restaurant.publicUrl', 'URL pública vazia: QR Code usaria o endereço atual do navegador');
  else if (!/^https:\/\/[^\s]+[^/]$/.test(r.publicUrl))
    add('erro', 'restaurant.publicUrl', 'use https:// e sem barra no fim');
  if (r.phoneDigits && !/^55\d{10,11}$/.test(r.phoneDigits))
    add('erro', 'restaurant.phoneDigits', 'formato esperado: 55 + DDD + número, só dígitos');
  if (r.phoneDisplay && !r.phoneDigits) add('aviso', 'restaurant.phoneDigits', 'sem phoneDigits o telefone não fica clicável');
  if (!r.address) add('aviso', 'restaurant.address', 'endereço não informado: seção some do site');
  else if (!r.address.mapsUrl) add('aviso', 'restaurant.address.mapsUrl', 'sem link do Google Maps');
  if (!r.openingHours?.length) add('aviso', 'restaurant.openingHours', 'horário não informado: seção some do site');
  if (!r.logo) add('aviso', 'restaurant.logo', 'sem logo: o nome aparece em texto');
  if (!r.heroImage) add('aviso', 'restaurant.heroImage', 'sem foto de capa: hero usa a cor da marca');
  if (r.heroImage && !r.heroImageAlt) add('aviso', 'restaurant.heroImageAlt', 'descreva a foto de capa (acessibilidade)');
  checkImage('restaurant.logo', r.logo);
  checkImage('restaurant.heroImage', r.heroImage);
  for (const [key, url] of Object.entries(r.social ?? {})) {
    if (url && !/^https:\/\//.test(url)) add('erro', `restaurant.social.${key}`, 'link deve começar com https://');
  }

  // Tema
  for (const key of ['primary', 'accent', 'background', 'surface', 'text'] as const) {
    if (!HEX_COLOR.test(config.theme[key])) add('erro', `theme.${key}`, `cor inválida "${config.theme[key]}" (use #rrggbb)`);
  }
  if (!(config.theme.font in FONT_PRESETS))
    add('erro', 'theme.font', `fonte inválida; opções: ${Object.keys(FONT_PRESETS).join(', ')}`);
  if (HEX_COLOR.test(config.theme.text) && HEX_COLOR.test(config.theme.surface)) {
    const ratio = contrastRatio(config.theme.text, config.theme.surface);
    if (ratio < 4.5) add('erro', 'theme.text', `contraste texto/card ${ratio.toFixed(1)}:1 (mínimo 4.5:1)`);
  }
  if (HEX_COLOR.test(config.theme.primary) && HEX_COLOR.test(config.theme.surface)) {
    const ratio = contrastRatio(config.theme.primary, config.theme.surface);
    if (ratio < 3) add('aviso', 'theme.primary', `preços na cor da marca têm contraste ${ratio.toFixed(1)}:1 com o card (recomendado ≥ 3:1)`);
  }

  // Categorias
  const categoryIds = new Set<string>();
  for (const c of config.categories) {
    if (!SLUG.test(c.id)) add('erro', `categories.${c.id}`, 'id deve ser slug: minúsculas, números e hífens');
    if (categoryIds.has(c.id)) add('erro', `categories.${c.id}`, 'id de categoria duplicado');
    categoryIds.add(c.id);
    if (!c.name.trim()) add('erro', `categories.${c.id}`, 'categoria sem nome');
  }

  // Produtos
  const productIds = new Set<string>();
  for (const p of config.products) {
    const f = `products.${p.id}`;
    if (!SLUG.test(p.id)) add('erro', f, 'id deve ser slug: minúsculas, números e hífens');
    if (productIds.has(p.id)) add('erro', f, 'id de produto duplicado');
    productIds.add(p.id);
    if (!p.name.trim()) add('erro', f, 'produto sem nome');
    if (!categoryIds.has(p.categoryId)) add('erro', f, `categoryId "${p.categoryId}" não existe em categories`);
    if (p.prices.length === 0) add('erro', f, 'sem preços (use [{ value: null }] para PRECISA CONFIRMAR)');
    if (p.prices.length > 1 && p.prices.some((o) => !o.label?.trim()))
      add('erro', f, 'produto com vários preços precisa de label em cada um');
    for (const o of p.prices) {
      if (o.value === null) add('bloqueia-publicacao', f, `preço${o.label ? ` "${o.label}"` : ''}: PRECISA CONFIRMAR`);
      else if (!Number.isFinite(o.value) || o.value < 0) add('erro', f, `preço inválido: ${o.value}`);
      else if (Math.abs(o.value * 100 - Math.round(o.value * 100)) > 1e-6) add('erro', f, `preço com mais de 2 casas decimais: ${o.value}`);
    }
    if (!p.verified) add('bloqueia-publicacao', f, 'produto não verificado pelo dono (fica oculto em produção)');
    if (!p.image) add('aviso', f, 'sem foto: usa placeholder neutro');
    checkImage(`${f}.image`, p.image);
    if (!p.description) add('aviso', f, 'sem descrição');
  }

  for (const c of config.categories) {
    if (!config.products.some((p) => p.categoryId === c.id && isPublishable(p)))
      add('aviso', `categories.${c.id}`, 'nenhum produto publicável: categoria fica oculta em produção');
  }

  return issues;
}
