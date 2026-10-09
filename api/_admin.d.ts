// Typy dla _admin.js (importowanego też w vite.config.ts).
export interface AdminStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<unknown>;
}
export declare function redisStore(): AdminStore | undefined;
export declare function fileStore(file: string): AdminStore;
export declare function handleAdmin(request: {
  method?: string;
  action: string;
  body?: Record<string, unknown>;
  cookie?: string;
  secure?: boolean;
  store?: AdminStore;
}): Promise<{ status: number; body: unknown; setCookie?: string }>;
