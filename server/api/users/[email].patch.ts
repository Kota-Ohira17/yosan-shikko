import { eq } from 'drizzle-orm'

/** ユーザーの権限・担当局を変える（管理者のみ） */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'manageUsers')
  const email = decodeURIComponent(getRouterParam(event, 'email') ?? '').toLowerCase()
  const body = parseOr400(roleAssignmentSchema.safeParse(await readBody(event)))

  const target = await findUserOr404(email)
  if (body.role !== 'admin') await assertCanRemoveAdmin(target)

  const [updated] = await useDb()
    .update(schema.users)
    .set({ role: body.role, bureau: body.role === 'bureau_head' ? body.bureau : '' })
    .where(eq(schema.users.email, email))
    .returning()
  return toUserView(updated!)
})
