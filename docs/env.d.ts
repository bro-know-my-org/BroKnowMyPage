/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_ARTALK_SERVER?: string
  readonly VITE_ARTALK_SITE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
