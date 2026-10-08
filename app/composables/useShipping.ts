type OrderRow = {
  id: number
  seq: string
  type: string
  status: string
  amount: number | null
  details: unknown
  items: { budgetAmount: number, actualAmount: number | null }[]
}

/** 発注1件の金額（申請の金額、なければ明細の執行額・予算額の合計） */
export function orderAmountOf(row: OrderRow) {
  return row.amount ?? row.items.reduce((s, i) => s + (i.actualAmount ?? i.budgetAmount), 0)
}

/** 発注のサイト名 */
export const siteOf = (row: Pick<OrderRow, 'details'>) => String((row.details as { site?: string } | null)?.site ?? '')

/** 同じサイトの未対応の発注（exceptId の申請は除く） */
export function pendingOrdersOf(rows: OrderRow[] | null | undefined, site: string, exceptId?: number) {
  return (rows ?? [])
    .filter(r => r.type === '発注' && r.status === 'pending' && r.id !== exceptId && siteOf(r) === site)
    .map(r => ({ seq: r.seq, amount: orderAmountOf(r) }))
}
