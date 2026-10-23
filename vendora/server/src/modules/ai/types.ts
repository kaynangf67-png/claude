import type { EffectiveRules, FieldStatusMap, ListingContent, MarketplaceId, ProductData } from '@vendora/shared';

export type GenerationPart = 'all' | 'title' | 'description';

export interface GenerationInput {
  product: ProductData;
  fieldStatus: FieldStatusMap;
  marketplace: MarketplaceId;
  rules: EffectiveRules;
  part: GenerationPart;
  /** Versão atual, quando se regenera só uma parte. */
  current?: ListingContent;
  audience?: string;
}

export interface ListingGenerator {
  /** anthropic | basic */
  readonly id: 'anthropic' | 'basic';
  readonly model: string | null;
  generate(input: GenerationInput): Promise<ListingContent>;
}
