/// <reference types="vite/client" />

/** Версия приложения из package.json (инжектируется Vite) */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_META_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
