// Typy dla _admin.js (importowanego też w vite.config.ts).
export interface AdminStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<unknown>;
  increment?(key: string, field: string): Promise<unknown>;
  readCounters?(keys: string[]): Promise<Record<string, number>[]>;
}
export declare function redisStore(): AdminStore | undefined;
export declare function fileStore(file: string): AdminStore;
export declare function handleAdmin(request: {
  method?: string;
  action: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  cookie?: string;
  secure?: boolean;
  store?: AdminStore;
}): Promise<{
  status: number;
  body?: unknown;
  setCookie?: string;
  cacheControl?: string;
  binary?: { contentType: string; data: Buffer };
}>;
