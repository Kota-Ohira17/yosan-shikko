import { z } from 'zod'

const devLoginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('メールアドレスの形式で入力してください')),
  name: z.string().trim().min(1, '氏名を入力してください'),
})

/** ローカル開発用ログイン。NUXT_PUBLIC_DEV_LOGIN=true のときだけ有効 */
export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig().public.devLogin) {
    throw createError({ statusCode: 404 })
  }
  const { email, name } = parseOr400(devLoginSchema.safeParse(await readBody(event)))
  await loginAs(event, email, name)
  return { ok: true }
})
