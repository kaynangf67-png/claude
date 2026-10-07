import type { SupabaseClient } from '@supabase/supabase-js';
import { uuid } from '@/lib/utils';
import type { Bucket, FileStorage } from '@/services/data/types';

const PUBLIC_BUCKETS: Bucket[] = ['avatars', 'product-images'];
const SIGNED_URL_TTL = 60 * 60; // 1h

export class SupabaseStorage implements FileStorage {
  constructor(private readonly db: SupabaseClient, private readonly userId: string) {}

  async upload(bucket: Bucket, file: Blob, opts: { name: string; onProgress?: (pct: number) => void }): Promise<string> {
    const ext = opts.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    // Pasta = user_id: é isso que as policies de storage.objects verificam.
    const path = `${this.userId}/${uuid()}.${ext}`;
    opts.onProgress?.(5);
    // Para vídeos grandes, trocar por upload resumável (TUS) — ver README.
    const { error } = await this.db.storage.from(bucket).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    opts.onProgress?.(100);
    return path;
  }

  async resolveUrl(bucket: Bucket, path: string): Promise<string | null> {
    if (PUBLIC_BUCKETS.includes(bucket)) return this.db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const { data, error } = await this.db.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL);
    if (error) return null;
    return data.signedUrl;
  }

  async remove(bucket: Bucket, path: string): Promise<void> {
    const { error } = await this.db.storage.from(bucket).remove([path]);
    if (error) throw new Error(error.message);
  }
}
