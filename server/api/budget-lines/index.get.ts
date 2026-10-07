import { asc } from 'drizzle-orm'

/** 予算明細の一覧（申請フォームの項目選択用） */
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return useDb().select().from(schema.budgetLines).orderBy(asc(schema.budgetLines.sortOrder))
})
