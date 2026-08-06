interface ImportMetaEnv {
  readonly VITE_KAJAY_RUNTIME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
