import type { Config } from './config';
import type { Db } from './db';
import type { ListingGenerator } from './modules/ai/types';
import type { BackgroundRemover } from './modules/images/backgroundRemoval';
import type { MarketplaceAdapter } from './modules/marketplaces/adapters';
import type { ObjectStorage } from './modules/storage/storage';
import type { Fetcher } from './security/safeFetch';
import type { MarketplaceId } from '@vendora/shared';

/** Dependências injetáveis — permite trocar provedores e testar sem rede. */
export interface AppContext {
  config: Config;
  db: Db;
  storage: ObjectStorage;
  fetcher: Fetcher;
  generator: ListingGenerator;
  bgRemover: BackgroundRemover | null;
  adapters: Record<MarketplaceId, MarketplaceAdapter>;
}
