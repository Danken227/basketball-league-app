// Typy dla _youtube.js (importowanego też w vite.config.ts).
export declare const YOUTUBE_CHANNEL_ID: string;
export declare function fetchYoutubeFeed(): Promise<{ id: string; title: string; published?: string }[]>;
