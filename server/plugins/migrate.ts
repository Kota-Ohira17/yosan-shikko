import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/libsql/migrator'

export default defineNitroPlugin(async () => {
  const { databaseUrl, uploadDir } = useRuntimeConfig()
  await mkdir(uploadDir, { recursive: true })
  if (databaseUrl.startsWith('file:')) {
    await mkdir(resolve(databaseUrl.slice('file:'.length), '..'), { recursive: true })
  }
  await migrate(useDb(), { migrationsFolder: resolve(process.cwd(), 'server/db/migrations') })
})
