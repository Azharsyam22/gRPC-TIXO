/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TIXO_MODE?: 'demo' | 'grpc-web'
  readonly VITE_TIXO_GRPC_WEB_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
