import type { Config } from './config';
import type { Db } from './db';
import type { ListingGenerator } from './modules/ai/types';
import type { PhotoReader } from './modules/ai/vision';
import type { BackgroundRemover } from './modules/images/backgroundRemoval';
import type { SceneGenerator } from './modules/images/scenes';
import type { ObjectStorage } from './modules/storage/storage';
import type { Fetcher } from './security/safeFetch';

/** Dependências injetáveis — permite trocar provedores e testar sem rede. */
export interface AppContext {
  config: Config;
  db: Db;
  storage: ObjectStorage;
  fetcher: Fetcher;
  generator: ListingGenerator;
  /** Leitura de fotos por IA; null quando nenhum provedor está configurado. */
  photoReader: PhotoReader | null;
  bgRemover: BackgroundRemover | null;
  /** Cenas geradas por IA com o produto da foto; null sem GEMINI_API_KEY. */
  sceneGenerator: SceneGenerator | null;
}
