import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/libsql/migrator'

/**
 * ローカル開発（file: の SQLite）のときだけ、起動時にマイグレーションを流す。
 * 本番（Turso）はビルド時に `drizzle-kit migrate` で流す（package.json の build:vercel）。
 */
export default defineNitroPlugin(async () => {
  const { databaseUrl } = useRuntimeConfig()
  if (!databaseUrl.startsWith('file:')) return
  await mkdir(resolve(databaseUrl.slice('file:'.length), '..'), { recursive: true })
  await migrate(useDb(), { migrationsFolder: resolve(process.cwd(), 'server/db/migrations') })
})
