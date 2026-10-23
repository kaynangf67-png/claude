import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { del as blobDel, get as blobGet, put as blobPut } from '@vercel/blob';
import type { Config } from '../../config';

export interface ObjectStorage {
  readonly driver: 'local' | 's3' | 'vercel-blob';
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/** Chaves geradas pelo servidor; nunca a partir de nomes enviados pelo usuário. */
export function newStorageKey(userId: string, ext: string): string {
  const owner = createHash('sha256').update(userId).digest('hex').slice(0, 16);
  return `u/${owner}/${randomBytes(16).toString('hex')}.${ext}`;
}

class LocalStorage implements ObjectStorage {
  readonly driver = 'local' as const;
  constructor(private readonly root: string) {}

  private resolve(key: string) {
    if (!/^u\/[0-9a-f]{16}\/[0-9a-f]{32}\.(jpg|png|webp)$/.test(key)) throw new Error('Chave de armazenamento inválida');
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Caminho fora do diretório de armazenamento');
    return full;
  }
  async put(key: string, body: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body, { mode: 0o600 });
  }
  get(key: string) {
    return readFile(this.resolve(key));
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}

/** Compatível com AWS S3, Cloudflare R2, MinIO etc. Bucket deve ser privado. */
class S3Storage implements ObjectStorage {
  readonly driver = 's3' as const;
  private readonly client: S3Client;
  constructor(
    private readonly bucket: string,
    config: Config,
  ) {
    this.client = new S3Client({
      region: config.S3_REGION ?? 'auto',
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: Boolean(config.S3_ENDPOINT),
      credentials:
        config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY }
          : undefined,
    });
  }
  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }
  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/** Vercel Blob em modo privado: nada fica acessível sem passar pela API (URL assinada). */
class VercelBlobStorage implements ObjectStorage {
  readonly driver = 'vercel-blob' as const;
  async put(key: string, body: Buffer, contentType: string) {
    await blobPut(key, body, { access: 'private', contentType, addRandomSuffix: false });
  }
  async get(key: string) {
    const res = await blobGet(key, { access: 'private' });
    if (!res || res.statusCode !== 200) throw new Error('Arquivo não encontrado no armazenamento');
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  }
  async delete(key: string) {
    await blobDel(key);
  }
}

export function createStorage(config: Config): ObjectStorage {
  if (config.STORAGE_DRIVER === 'vercel-blob') return new VercelBlobStorage();
  if (config.STORAGE_DRIVER === 's3') {
    if (!config.S3_BUCKET) throw new Error('STORAGE_DRIVER=s3 exige S3_BUCKET');
    return new S3Storage(config.S3_BUCKET, config);
  }
  return new LocalStorage(path.resolve(config.STORAGE_LOCAL_DIR));
}

/**
 * URLs assinadas e com validade para servir imagens sem expor o armazenamento.
 * O <img> do navegador não envia o cookie em todos os contextos (ex.: download),
 * então a assinatura é a credencial — e expira.
 */
// Subchave dedicada: a chave mestra não é usada diretamente para assinar URLs.
const urlKey = (secret: string) => createHmac('sha256', secret).update('vendora:asset-url:v1').digest();

export function signAssetUrl(secret: string, assetId: string, ttlSeconds = 3600, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  const sig = createHmac('sha256', urlKey(secret)).update(`${assetId}.${exp}`).digest('base64url');
  return `/api/assets/${assetId}/file?exp=${exp}&sig=${sig}`;
}

export function verifyAssetSignature(secret: string, assetId: string, exp: string, sig: string, now = Date.now()): boolean {
  const expNum = Number(exp);
  if (!Number.isInteger(expNum) || expNum * 1000 < now) return false;
  const expected = createHmac('sha256', urlKey(secret)).update(`${assetId}.${expNum}`).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, 'base64url');
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}
