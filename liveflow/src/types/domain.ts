// Tipos de domínio do LiveFlow. Espelham o schema em supabase/migrations.

export type ID = string;

export interface BaseRecord {
  id: ID;
  user_id: ID;
  created_at: string;
  updated_at: string;
}

export type PlanTier = 'free' | 'pro' | 'premium';
export type ProductStatus = 'active' | 'paused' | 'archived';
export type VideoStatus = 'available' | 'scheduled' | 'streaming' | 'finished' | 'archived';
export type LiveStatus = 'draft' | 'scheduled' | 'running' | 'finished' | 'cancelled' | 'error';
export type IntegrationStatus = 'disconnected' | 'connected' | 'expired' | 'error';

export interface Profile extends BaseRecord {
  full_name: string;
  email: string;
  avatar_url: string | null;
  plan: PlanTier;
  onboarding_completed: boolean;
  preferences: UserPreferences;
}

export interface UserPreferences {
  notifyBeforeLive?: boolean;
  notifyDailySummary?: boolean;
  notifyErrors?: boolean;
  timezone?: string;
  defaultLiveDuration?: number;
}

export interface Product extends BaseRecord {
  name: string;
  description: string;
  image_url: string | null;
  price: number;
  promo_price: number | null;
  commission_rate: number;
  category: string;
  product_url: string | null;
  sku: string | null;
  status: ProductStatus;
}

export interface Video extends BaseRecord {
  product_id: ID | null;
  name: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  duration_seconds: number;
  size_bytes: number;
  mime_type: string | null;
  status: VideoStatus;
  usage_count: number;
  processing_status: 'pending' | 'processing' | 'ready' | 'failed';
}

export type RecurrenceFrequency = 'none' | 'daily' | 'weekdays' | 'weekly' | 'interval';

export interface Recurrence {
  frequency: RecurrenceFrequency;
  /** HH:mm */
  time: string;
  /** yyyy-MM-dd */
  startDate: string;
  /** yyyy-MM-dd (inclusive) */
  endDate?: string | null;
  /** 0=domingo … 6=sábado (frequency = weekly) */
  weekdays?: number[];
  /** a cada N dias (frequency = interval) */
  intervalDays?: number;
}

export interface LiveSchedule extends BaseRecord {
  video_id: ID | null;
  product_id: ID | null;
  title: string;
  description: string;
  duration_minutes: number;
  recurrence: Recurrence;
  timezone: string;
  generated_until: string | null;
}

export interface Automation extends BaseRecord {
  schedule_id: ID;
  name: string;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
}

export interface Live extends BaseRecord {
  video_id: ID | null;
  product_id: ID | null;
  schedule_id: ID | null;
  title: string;
  description: string;
  starts_at: string;
  duration_minutes: number;
  status: LiveStatus;
  external_id: string | null;
  error_message: string | null;
}

export interface AnalyticsRow extends BaseRecord {
  date: string;
  product_id: ID | null;
  video_id: ID | null;
  live_id: ID | null;
  views: number;
  clicks: number;
  conversions: number;
  units_sold: number;
  revenue: number;
  commission: number;
  cost: number;
  source: 'manual' | 'demo' | 'tiktok';
}

export type NotificationType =
  | 'product_created'
  | 'video_uploaded'
  | 'live_created'
  | 'live_scheduled'
  | 'live_cancelled'
  | 'automation_created'
  | 'live_error'
  | 'system';

export interface AppNotification extends BaseRecord {
  type: NotificationType;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: ID | null;
  read_at: string | null;
}

export type AIGenerationKind = 'script' | 'variations' | 'hooks' | 'copilot';

export interface AIGeneration extends BaseRecord {
  kind: AIGenerationKind;
  product_id: ID | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  provider: string;
}

export interface Integration extends BaseRecord {
  provider: 'tiktok' | 'tiktok_shop';
  status: IntegrationStatus;
  account_name: string | null;
  scopes: string[];
  connected_at: string | null;
}

/** Campos que o client informa ao criar um registro. */
export type NewRecord<T extends BaseRecord> = Omit<T, keyof BaseRecord>;
export type Patch<T extends BaseRecord> = Partial<NewRecord<T>>;
