import type { Api } from './types'
import { httpApi } from './client'
import { mockApi } from './mock'

/** VITE_USE_MOCK=1 serves from the in-memory fake fleet (see mock.ts). */
export const USING_MOCK = import.meta.env.VITE_USE_MOCK === '1'
export const api: Api = USING_MOCK ? mockApi : httpApi
export * from './types'
