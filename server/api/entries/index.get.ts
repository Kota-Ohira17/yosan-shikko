import { and, asc, eq, not, sql, type SQL } from 'drizzle-orm'
import { PAYMENT_TYPES, VIEWS, type ViewKey } from '../../../shared/constants'

/**
 * 一覧。旧スプレッドシートの各シートを view で切り替える。
 * 会計担当は全件、それ以外は自分の申請だけ。
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const raw = String(getQuery(event).view ?? 'time')
  const view: ViewKey = raw in VIEWS ? (raw as ViewKey) : 'time'
  const e = schema.entries

  const conds: SQL[] = []
  if (!user.isAdmin) conds.push(eq(e.applicantEmail, user.email))

  // 期限が近い順（期限なしは最後）
  const byDeadline = [sql`${e.deadline} is null`, asc(e.deadline), asc(e.createdAt)]
  let orderBy: SQL[]

  if (view === 'number' || view === 'time') {
    // 立替の執行依頼は台帳に載せず、証憑提出の時点で載せる（旧GASと同じ）
    conds.push(not(and(eq(e.kind, 'execution'), eq(e.type, '立替'))!))
    orderBy = view === 'number' ? [asc(e.itemNumber), asc(e.createdAt)] : [asc(e.createdAt)]
  }
  else if (view === 'pending') {
    conds.push(eq(e.status, 'pending'))
    orderBy = byDeadline
  }
  else {
    conds.push(eq(e.type, view as (typeof PAYMENT_TYPES)[number]))
    orderBy = byDeadline
  }

  const rows = await useDb()
    .select()
    .from(e)
    .where(and(...conds))
    .orderBy(...orderBy)

  return (await withItems(rows)).map(r => toPublicEntry(r, user.isAdmin))
})
