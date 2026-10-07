import { and, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ROLES } from '../../../shared/roles'

const bodySchema = z.object({
  role: z.enum(ROLES, { error: '権限を選んでください' }),
  bureau: z.string().trim().default(''),
}).refine(v => v.role !== 'bureau_head' || v.bureau !== '', { message: '局長には担当局を選んでください', path: ['bureau'] })

/** ユーザーの権限・担当局を変える（管理者のみ） */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'manageUsers')
  const email = decodeURIComponent(getRouterParam(event, 'email') ?? '').toLowerCase()
  const body = parseOr400(bodySchema.safeParse(await readBody(event)))
  const db = useDb()
  const u = schema.users

  const target = await db.query.users.findFirst({ where: eq(u.email, email) })
  if (!target) throw createError({ statusCode: 404, message: 'ユーザーが見つかりません' })

  if (body.role !== 'admin') {
    if (isBootstrapAdmin(email)) {
      throw createError({ statusCode: 400, message: 'このユーザーは環境変数 NUXT_ADMIN_EMAILS で管理者に固定されています' })
    }
    // 管理者がいなくなると誰も権限を戻せなくなる
    const [{ others }] = await db
      .select({ others: sql<number>`count(*)` })
      .from(u)
      .where(and(eq(u.role, 'admin'), ne(u.email, email))) as [{ others: number }]
    if (target.role === 'admin' && others === 0) {
      throw createError({ statusCode: 400, message: '管理者が1人もいなくなるため変更できません' })
    }
  }

  const [updated] = await db
    .update(u)
    .set({ role: body.role, bureau: body.role === 'bureau_head' ? body.bureau : '' })
    .where(eq(u.email, email))
    .returning()
  return { ...updated!, bootstrapAdmin: isBootstrapAdmin(email) }
})
