/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_OWNER_EMAIL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Injected at build time by vite.config.ts `define`.
declare const __APP_VERSION__: string
declare const __BUILD_SHA__: string
