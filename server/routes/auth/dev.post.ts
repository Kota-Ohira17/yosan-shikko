import { z } from 'zod'

/** ローカル開発用ログイン。NUXT_PUBLIC_DEV_LOGIN=true のときだけ有効 */
export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig().public.devLogin) {
    throw createError({ statusCode: 404 })
  }
  const { email, name } = parseOr400(
    z.object({ email: z.email(), name: z.string().trim().min(1) }).safeParse(await readBody(event)),
  )
  await loginAs(event, email, name)
  return { ok: true }
})
