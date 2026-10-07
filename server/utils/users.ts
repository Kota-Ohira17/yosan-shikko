import { and, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ROLES } from '../../shared/roles'
import type { User } from '../db/schema'

export const roleAssignmentSchema = z.object({
  role: z.enum(ROLES, { error: '権限を選んでください' }),
  bureau: z.string().trim().default(''),
}).refine(v => v.role !== 'bureau_head' || v.bureau !== '', { message: '局長には担当局を選んでください', path: ['bureau'] })

export const newUserSchema = roleAssignmentSchema.and(z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('メールアドレスの形式で入力してください')),
  name: z.string().trim().default(''),
}))

/** 画面に返す形（NUXT_ADMIN_EMAILS で固定された管理者かどうかを付ける） */
export function toUserView(u: User) {
  return { ...u, bootstrapAdmin: isBootstrapAdmin(u.email) }
}

/**
 * 管理者を外す（降格・削除する）前のチェック。
 * 環境変数で固定された管理者は外せず、管理者が1人もいなくなる変更もできない。
 */
export async function assertCanRemoveAdmin(target: User) {
  if (isBootstrapAdmin(target.email)) {
    throw createError({ statusCode: 400, message: 'このユーザーは環境変数 NUXT_ADMIN_EMAILS で管理者に固定されています' })
  }
  if (target.role !== 'admin') return
  const u = schema.users
  const [row] = await useDb()
    .select({ others: sql<number>`count(*)` })
    .from(u)
    .where(and(eq(u.role, 'admin'), ne(u.email, target.email)))
  if (!row?.others) {
    throw createError({ statusCode: 400, message: '管理者が1人もいなくなるため変更できません' })
  }
}

export async function findUserOr404(email: string) {
  const user = await useDb().query.users.findFirst({ where: eq(schema.users.email, email) })
  if (!user) throw createError({ statusCode: 404, message: 'ユーザーが見つかりません' })
  return user
}
