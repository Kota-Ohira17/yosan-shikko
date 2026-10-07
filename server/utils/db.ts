import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '../db/schema'

let db: ReturnType<typeof createDb> | undefined

function createDb() {
  const { databaseUrl, databaseAuthToken } = useRuntimeConfig()
  const client = createClient({ url: databaseUrl, authToken: databaseAuthToken || undefined })
  return drizzle(client, { schema })
}

export function useDb() {
  db ??= createDb()
  return db
}

export { schema }
