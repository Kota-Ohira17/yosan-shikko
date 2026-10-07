import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'turso',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL || 'file:.data/app.db',
    authToken: process.env.NUXT_DATABASE_AUTH_TOKEN || undefined,
  },
})
