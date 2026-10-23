// archiver 8 é ESM e ainda não tem tipos publicados; declaramos só o que usamos.
declare module 'archiver' {
  import type { Readable, Writable } from 'node:stream';
  export class ZipArchive {
    constructor(options?: { zlib?: { level?: number } });
    pipe<T extends Writable>(destination: T): T;
    append(source: Buffer | string | Readable, data: { name: string }): this;
    finalize(): Promise<void>;
  }
}
