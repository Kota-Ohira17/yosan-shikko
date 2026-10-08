import { asc, eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { buildSheetRows, SHEET_COLUMN_LABELS, SHEET_COLUMNS, type Level } from '../../shared/budgetRows'
import type { BudgetLine } from '../db/schema'

/**
 * 決算シート（Excel）。対応済みの申請をまとめて、予算明細ごとの執行額を集計する。
 * - 「決算」: 本予算「支出」シートと同じ並びで、明細ごとに予算額・執行額・差額・執行率。見出しの行には小計
 * - 「執行一覧」: 対応済みの申請を明細ごとに1行ずつ
 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'viewAllEntries')
  const db = useDb()
  const lines = await db.select().from(schema.budgetLines).orderBy(asc(schema.budgetLines.sortOrder))
  const done = await withItems(
    await db.select().from(schema.entries).where(eq(schema.entries.status, 'done')).orderBy(asc(schema.entries.createdAt)),
  )

  // 明細ごとの執行額の集計
  const agg = new Map<string, { actual: number, unknown: number, seqs: string[] }>()
  for (const entry of done) {
    for (const item of entry.items) {
      const rec = agg.get(item.lineKey) ?? { actual: 0, unknown: 0, seqs: [] }
      const actual = actualAmountOf(item, entry)
      if (actual == null) rec.unknown++
      else rec.actual += actual
      if (!rec.seqs.includes(entry.seq)) rec.seqs.push(entry.seq)
      agg.set(item.lineKey, rec)
    }
  }
  const outsideBudget = done.filter(e => !e.items.length)

  const wb = new ExcelJS.Workbook()
  wb.creator = '予算執行'
  wb.created = new Date()
  writeSettlementSheet(wb, lines, agg, outsideBudget)
  writeExecutionSheet(wb, done)

  const buffer = await wb.xlsx.writeBuffer()
  const stamp = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).replaceAll('-', '')
  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="settlement_${stamp}.xlsx"; filename*=UTF-8''${encodeURIComponent(`決算_${stamp}.xlsx`)}`,
    'Cache-Control': 'private, no-store',
  })
  return Buffer.from(buffer)
})

const YEN = '#,##0;[Red]-#,##0'
const LEVEL_FILL: Partial<Record<Level, string>> = {
  bureau: 'FFC9DCF2',
  team: 'FFF1F4F8',
  kan: 'FFDCE8F7',
  kou: 'FFEAF1FA',
  moku: 'FFF4F8FC',
  setsu: 'FFFAFCFE',
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
  row.border = { bottom: { style: 'thin' } }
}

type Agg = Map<string, { actual: number, unknown: number, seqs: string[] }>

function writeSettlementSheet(
  wb: ExcelJS.Workbook,
  lines: BudgetLine[],
  agg: Agg,
  outsideBudget: { seq: string, itemNumber: string, itemName: string, amount: number | null }[],
) {
  const ws = wb.addWorksheet('決算', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    ...SHEET_COLUMNS.map(c => ({ header: SHEET_COLUMN_LABELS[c], key: c, width: c === 'number' ? 14 : c === 'bureau' || c === 'team' ? 10 : 22 })),
    { header: '数量', key: 'quantity', width: 10 },
    { header: '取引先', key: 'vendor', width: 14 },
    { header: '予算額', key: 'budget', width: 13, style: { numFmt: YEN } },
    { header: '執行額', key: 'actual', width: 13, style: { numFmt: YEN } },
    { header: '差額（予算−執行）', key: 'diff', width: 15, style: { numFmt: YEN } },
    { header: '執行率', key: 'rate', width: 8, style: { numFmt: '0.0%' } },
    { header: '件数', key: 'count', width: 6 },
    { header: '申請番号', key: 'seqs', width: 24 },
    { header: '備考', key: 'note', width: 22 },
  ]
  styleHeader(ws.getRow(1))

  const { rows, descendants } = buildSheetRows(lines)
  const byKey = new Map(lines.map(l => [l.key, l]))
  const totalsOf = (keys: string[]) => keys.reduce((t, k) => {
    const a = agg.get(k)
    t.budget += byKey.get(k)?.budgetAmount ?? 0
    t.actual += a?.actual ?? 0
    t.unknown += a?.unknown ?? 0
    return t
  }, { budget: 0, actual: 0, unknown: 0 })
  // 局・担当の見出しは descendants に入らないので、明細から直接まとめる
  const bureauKeys = Map.groupBy(lines, l => `${l.bureauNo}|${l.bureau}`)
  const teamKeys = Map.groupBy(lines, l => `${l.bureauNo}|${l.bureau}|${l.team}`)
  let currentBureau = ''

  for (const row of rows) {
    if (row.kind === 'group') {
      let keys: string[] = []
      if (row.level === 'bureau') {
        currentBureau = `${row.cells.number ?? ''}|${row.cells.bureau ?? ''}`
        keys = bureauKeys.get(currentBureau)?.map(l => l.key) ?? []
      }
      else if (row.level === 'team') keys = teamKeys.get(`${currentBureau}|${row.cells.team ?? ''}`)?.map(l => l.key) ?? []
      else keys = descendants.get(row.path!) ?? []
      const t = totalsOf(keys)
      const r = ws.addRow({
        ...row.cells,
        budget: t.budget,
        actual: t.actual,
        diff: t.budget - t.actual,
        rate: t.budget ? t.actual / t.budget : null,
        note: t.unknown ? `執行額未入力 ${t.unknown}件` : '',
      })
      r.font = { bold: row.level === 'bureau' || row.level === 'kan', italic: false }
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LEVEL_FILL[row.level] ?? 'FFFFFFFF' } }
      continue
    }
    const l = row.line!
    const a = agg.get(l.key)
    ws.addRow({
      ...row.cells,
      quantity: l.quantity,
      vendor: l.vendor,
      budget: l.budgetAmount,
      actual: a ? a.actual : null,
      diff: a ? l.budgetAmount - a.actual : null,
      rate: a && l.budgetAmount ? a.actual / l.budgetAmount : null,
      count: a?.seqs.length ?? null,
      seqs: a?.seqs.join(', ') ?? '',
      note: a?.unknown ? `執行額未入力 ${a.unknown}件` : '',
    })
  }

  // 予算にない項目（手入力の申請）
  if (outsideBudget.length) {
    ws.addRow({})
    const head = ws.addRow({ number: '予算にない項目' })
    head.font = { bold: true }
    for (const e of outsideBudget) {
      ws.addRow({ number: e.itemNumber, kou: e.itemName, actual: e.amount, count: 1, seqs: e.seq })
    }
  }

  // 総計
  const all = totalsOf(lines.map(l => l.key))
  const outside = outsideBudget.reduce((s, e) => s + (e.amount ?? 0), 0)
  ws.addRow({})
  const total = ws.addRow({
    number: '総計',
    budget: all.budget,
    actual: all.actual + outside,
    diff: all.budget - all.actual - outside,
    rate: all.budget ? (all.actual + outside) / all.budget : null,
  })
  total.font = { bold: true }
  total.border = { top: { style: 'double' } }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } }
}

function writeExecutionSheet(
  wb: ExcelJS.Workbook,
  done: Awaited<ReturnType<typeof withItems<typeof schema.entries.$inferSelect>>>,
) {
  const ws = wb.addWorksheet('執行一覧', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: '申請番号', key: 'seq', width: 10 },
    { header: '種別', key: 'kind', width: 8 },
    { header: '申請日', key: 'createdAt', width: 12, style: { numFmt: 'yyyy/mm/dd' } },
    { header: '執行日', key: 'executedAt', width: 12, style: { numFmt: 'yyyy/mm/dd' } },
    { header: '執行形態', key: 'paymentMethod', width: 14 },
    { header: '局', key: 'department', width: 10 },
    { header: '担当', key: 'inCharge', width: 10 },
    { header: '申請者', key: 'applicantName', width: 12 },
    { header: '支出項目名', key: 'itemName', width: 28 },
    { header: '項目番号', key: 'itemNumber', width: 14 },
    { header: '予算明細', key: 'label', width: 40 },
    { header: '予算額', key: 'budget', width: 12, style: { numFmt: YEN } },
    { header: '執行額', key: 'actual', width: 12, style: { numFmt: YEN } },
    { header: '申請の金額', key: 'entryAmount', width: 12, style: { numFmt: YEN } },
    { header: '備考', key: 'remark', width: 30 },
  ]
  styleHeader(ws.getRow(1))

  for (const e of done) {
    const base = {
      seq: e.seq,
      kind: e.kind === 'evidence' ? '証憑（立替）' : '執行依頼',
      createdAt: e.createdAt,
      executedAt: e.executedAt,
      paymentMethod: e.paymentMethod ?? e.type,
      department: e.department,
      inCharge: e.inCharge,
      applicantName: e.applicantName,
      itemName: e.itemName,
      entryAmount: e.amount,
      remark: e.remark,
    }
    if (!e.items.length) {
      ws.addRow({ ...base, itemNumber: e.itemNumber, label: '（予算にない項目）', actual: e.amount })
      continue
    }
    for (const i of e.items) {
      ws.addRow({ ...base, itemNumber: i.itemNumber, label: i.label, budget: i.budgetAmount, actual: actualAmountOf(i, e) })
    }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } }
}
