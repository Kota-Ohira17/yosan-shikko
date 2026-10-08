import { and, eq } from 'drizzle-orm'
import { itemAmountsUpdateSchema } from '../../../../shared/schemas'

/**
 * 明細ごとの実際の執行額を直す（財務局長・管理者のみ）。対応済みにする前後どちらでもよい。
 * 申請の金額は、すべての明細に執行額が入っていればその合計にそろえる。
 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'executeEntries')
  const id = Number(getRouterParam(event, 'id'))
  const { amounts } = parseOr400(itemAmountsUpdateSchema.safeParse(await readBody(event)))
  const db = useDb()
  const entry = await db.query.entries.findFirst({ where: eq(schema.entries.id, id) })
  if (!entry) throw createError({ statusCode: 404, message: '申請が見つかりません' })

  const [updated] = await db.transaction(async (tx) => {
    for (const [itemId, amount] of Object.entries(amounts)) {
      await tx.update(schema.entryItems)
        .set({ actualAmount: amount })
        .where(and(eq(schema.entryItems.id, Number(itemId)), eq(schema.entryItems.entryId, id)))
    }
    const items = await tx.select().from(schema.entryItems).where(eq(schema.entryItems.entryId, id))
    if (items.length && items.every(i => i.actualAmount != null)) {
      await tx.update(schema.entries)
        .set({ amount: items.reduce((s, i) => s + i.actualAmount!, 0) })
        .where(eq(schema.entries.id, id))
    }
    return tx.select().from(schema.entries).where(eq(schema.entries.id, id))
  })
  const [withItemsEntry] = await withItems([updated!])
  return withItemsEntry
})
