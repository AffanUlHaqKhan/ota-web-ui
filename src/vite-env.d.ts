/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" serves the in-memory fake fleet instead of a real ota-server. */
  readonly VITE_USE_MOCK: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
