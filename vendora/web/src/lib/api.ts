import type {
  EffectiveRules,
  FieldStatusMap,
  GenerationWarning,
  ListingContent,
  MarketplaceId,
  MarketplaceProfile,
  ProductData,
  ProfileOverrides,
  RuleIssue,
} from '@vendora/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined && !(body instanceof FormData) ? { 'content-type': 'application/json' } : undefined,
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Sem conexão com o servidor. Verifique sua internet.');
  }
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    const err = (data as { error?: { code: string; message: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'http', err?.message ?? `Erro ${res.status}.`);
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  put: <T>(p: string, b: unknown) => request<T>('PUT', p, b),
  patch: <T>(p: string, b: unknown) => request<T>('PATCH', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
};

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Product {
  id: string;
  sourceUrl: string | null;
  sourceDomain: string | null;
  method: string;
  status: 'extracted' | 'partial' | 'failed' | 'manual';
  data: ProductData;
  fieldStatus: FieldStatusMap;
  failureReason: string | null;
  createdAt: string;
}

export interface Asset {
  id: string;
  kind: 'original' | 'edited';
  parentId: string | null;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  sourceUrl: string | null;
  edits: Record<string, unknown> | null;
  promotional: boolean;
  isMain: boolean;
  url: string;
}

export interface ListingDetail {
  listing: {
    id: string;
    marketplace: MarketplaceId;
    status: 'draft' | 'saved' | 'exported';
    title: string;
    currentVersion: number;
    content: ListingContent;
    source: 'ai' | 'basic' | 'user';
    provider: string | null;
    model: string | null;
    warnings: GenerationWarning[];
    versions: Array<{ version: number; source: string; createdAt: string }>;
    updatedAt: string;
  };
  rules: EffectiveRules;
  product: Product;
  assets: Asset[];
}

export interface ListingSummary {
  id: string;
  marketplace: MarketplaceId;
  status: 'draft' | 'saved' | 'exported';
  title: string;
  currentVersion: number;
  sourceDomain: string | null;
  updatedAt: string;
}

export interface Meta {
  ai: { provider: 'anthropic' | 'basic'; model: string | null };
  backgroundRemoval: { provider: string } | null;
  storage: 'local' | 's3';
  respectRobotsTxt: boolean;
  integrations: Record<MarketplaceId, Capabilities>;
}

export type CapabilityState = 'implemented_untested' | 'needs_credentials' | 'not_implemented';
export interface Capabilities {
  authorization: CapabilityState;
  publish: CapabilityState;
  status: CapabilityState;
}

export interface MarketplaceInfo {
  profile: MarketplaceProfile;
  overrides: ProfileOverrides;
  rules: EffectiveRules;
}

export type { RuleIssue };
