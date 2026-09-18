/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_ENV?: "local" | "preview" | "production";
  readonly VITE_ENABLE_QUERY_DEVTOOLS?: "true" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
