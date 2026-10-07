import { eq } from 'drizzle-orm'

/** ユーザーの権限を変える（財務局長のみ） */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'manageUsers')
  const email = decodeURIComponent(getRouterParam(event, 'email') ?? '').toLowerCase()
  const body = parseOr400(roleAssignmentSchema.safeParse(await readBody(event)))

  const target = await findUserOr404(email)
  if (body.role !== 'admin') await assertCanRemoveAdmin(target)

  const [updated] = await useDb()
    .update(schema.users)
    .set({ role: body.role })
    .where(eq(schema.users.email, email))
    .returning()
  return toUserView(updated!)
})
