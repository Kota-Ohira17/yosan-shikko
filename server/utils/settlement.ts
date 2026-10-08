import { asc, eq } from 'drizzle-orm'
import { buildSheetRows, SHEET_COLUMN_LABELS, SHEET_COLUMNS, type Level } from '../../shared/budgetRows'
import type { BudgetLine, Entry, EntryItem } from '../db/schema'

/**
 * 決算シートの中身。Excel（/api/settlement.xlsx）とGoogleスプレッドシート（/api/settlement/sheets）の
 * 両方に同じ表を書き出すため、書き出し方に依存しない形で作る。
 * - 「決算」: 本予算「支出」シートと同じ並びで、明細ごとに予算額・執行額・差額・執行率・証憑。見出しの行には小計
 * - 「執行一覧」: 対応済みの申請を明細ごとに1行ずつ（証憑へのリンクつき）
 */

export type CellValue = string | number | Date | null | { text: string, url: string }

export interface TableColumn {
  key: string
  header: string
  /** 文字数の目安 */
  width: number
  format?: 'yen' | 'rate' | 'date'
}

export interface TableRow {
  values: Record<string, CellValue>
  bold?: boolean
  /** 背景色（RRGGBB） */
  fill?: string
  /** 上に二重線（総計の行） */
  topBorder?: boolean
}

export interface Table {
  name: string
  columns: TableColumn[]
  rows: TableRow[]
}

const LEVEL_FILL: Partial<Record<Level, string>> = {
  bureau: 'C9DCF2',
  team: 'F1F4F8',
  kan: 'DCE8F7',
  kou: 'EAF1FA',
  moku: 'F4F8FC',
  setsu: 'FAFCFE',
}

type DoneEntry = Entry & { items: EntryItem[] }

/** 証憑（請求書・領収書など）へのリンク。添付がなければ null */
function evidenceLink(e: DoneEntry, origin: string): { text: string, url: string } | null {
  if (!e.attachmentId) return null
  const kind = e.kind === 'evidence' ? String(e.details.kindOfEvidence ?? '証憑') : '請求書'
  return { text: `${e.seq} ${kind}`, url: `${origin}/api/entries/${e.id}/attachment` }
}

export async function buildSettlementTables(origin: string): Promise<Table[]> {
  const db = useDb()
  const lines = await db.select().from(schema.budgetLines).orderBy(asc(schema.budgetLines.sortOrder))
  const done: DoneEntry[] = await withItems(
    await db.select().from(schema.entries).where(eq(schema.entries.status, 'done')).orderBy(asc(schema.entries.createdAt)),
  )
  return [settlementTable(lines, done, origin), executionTable(done, origin)]
}

function settlementTable(lines: BudgetLine[], done: DoneEntry[], origin: string): Table {
  // 明細ごとの執行額・申請・証憑の集計
  const agg = new Map<string, { actual: number, unknown: number, entries: DoneEntry[] }>()
  for (const entry of done) {
    for (const item of entry.items) {
      const rec = agg.get(item.lineKey) ?? { actual: 0, unknown: 0, entries: [] }
      const actual = actualAmountOf(item, entry)
      if (actual == null) rec.unknown++
      else rec.actual += actual
      if (!rec.entries.includes(entry)) rec.entries.push(entry)
      agg.set(item.lineKey, rec)
    }
  }

  /** 証憑の列: 1件ならリンク、複数なら申請番号を並べて執行一覧を見てもらう */
  const evidenceCell = (entries: DoneEntry[]): CellValue => {
    const links = entries.map(e => evidenceLink(e, origin)).filter(l => l != null)
    if (!links.length) return null
    if (links.length === 1) return links[0]!
    return `${links.map(l => l.text).join('、')}（執行一覧にリンク）`
  }

  const columns: TableColumn[] = [
    ...SHEET_COLUMNS.map(c => ({ key: c, header: SHEET_COLUMN_LABELS[c], width: c === 'number' ? 14 : c === 'bureau' || c === 'team' ? 10 : 22 })),
    { key: 'quantity', header: '数量', width: 10 },
    { key: 'vendor', header: '取引先', width: 14 },
    { key: 'budget', header: '予算額', width: 13, format: 'yen' },
    { key: 'actual', header: '執行額', width: 13, format: 'yen' },
    { key: 'diff', header: '差額（予算−執行）', width: 15, format: 'yen' },
    { key: 'rate', header: '執行率', width: 8, format: 'rate' },
    { key: 'count', header: '件数', width: 6 },
    { key: 'seqs', header: '申請番号', width: 20 },
    { key: 'evidence', header: '証憑', width: 24 },
    { key: 'note', header: '備考', width: 22 },
  ]
  const rows: TableRow[] = []

  const { rows: sheetRows, descendants } = buildSheetRows(lines)
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

  for (const row of sheetRows) {
    if (row.kind === 'group') {
      let keys: string[] = []
      if (row.level === 'bureau') {
        currentBureau = `${row.cells.number ?? ''}|${row.cells.bureau ?? ''}`
        keys = bureauKeys.get(currentBureau)?.map(l => l.key) ?? []
      }
      else if (row.level === 'team') keys = teamKeys.get(`${currentBureau}|${row.cells.team ?? ''}`)?.map(l => l.key) ?? []
      else keys = descendants.get(row.path!) ?? []
      const t = totalsOf(keys)
      rows.push({
        values: {
          ...row.cells,
          budget: t.budget,
          actual: t.actual,
          diff: t.budget - t.actual,
          rate: t.budget ? t.actual / t.budget : null,
          note: t.unknown ? `執行額未入力 ${t.unknown}件` : '',
        },
        bold: row.level === 'bureau' || row.level === 'kan',
        fill: LEVEL_FILL[row.level],
      })
      continue
    }
    const l = row.line!
    const a = agg.get(l.key)
    rows.push({
      values: {
        ...row.cells,
        quantity: l.quantity,
        vendor: l.vendor,
        budget: l.budgetAmount,
        actual: a ? a.actual : null,
        diff: a ? l.budgetAmount - a.actual : null,
        rate: a && l.budgetAmount ? a.actual / l.budgetAmount : null,
        count: a?.entries.length ?? null,
        seqs: a?.entries.map(e => e.seq).join(', ') ?? '',
        evidence: a ? evidenceCell(a.entries) : null,
        note: a?.unknown ? `執行額未入力 ${a.unknown}件` : '',
      },
    })
  }

  // 予算にない項目（手入力の申請）
  const outsideBudget = done.filter(e => !e.items.length)
  if (outsideBudget.length) {
    rows.push({ values: {} })
    rows.push({ values: { number: '予算にない項目' }, bold: true })
    for (const e of outsideBudget) {
      rows.push({ values: { number: e.itemNumber, kou: e.itemName, actual: e.amount, count: 1, seqs: e.seq, evidence: evidenceLink(e, origin) } })
    }
  }

  // 総計
  const all = totalsOf(lines.map(l => l.key))
  const outside = outsideBudget.reduce((s, e) => s + (e.amount ?? 0), 0)
  rows.push({ values: {} })
  rows.push({
    values: {
      number: '総計',
      budget: all.budget,
      actual: all.actual + outside,
      diff: all.budget - all.actual - outside,
      rate: all.budget ? (all.actual + outside) / all.budget : null,
    },
    bold: true,
    topBorder: true,
  })

  return { name: '決算', columns, rows }
}

function executionTable(done: DoneEntry[], origin: string): Table {
  const columns: TableColumn[] = [
    { key: 'seq', header: '申請番号', width: 10 },
    { key: 'kind', header: '種別', width: 10 },
    { key: 'createdAt', header: '申請日', width: 12, format: 'date' },
    { key: 'executedAt', header: '執行日', width: 12, format: 'date' },
    { key: 'paymentMethod', header: '執行形態', width: 14 },
    { key: 'department', header: '局', width: 8 },
    { key: 'inCharge', header: '担当', width: 10 },
    { key: 'applicantName', header: '申請者', width: 12 },
    { key: 'itemName', header: '支出項目名', width: 28 },
    { key: 'itemNumber', header: '項目番号', width: 14 },
    { key: 'label', header: '予算明細', width: 40 },
    { key: 'quantity', header: '数量', width: 10 },
    { key: 'vendor', header: '取引先', width: 14 },
    { key: 'budget', header: '予算額', width: 12, format: 'yen' },
    { key: 'actual', header: '執行額', width: 12, format: 'yen' },
    { key: 'entryAmount', header: '申請の金額', width: 12, format: 'yen' },
    { key: 'evidence', header: '証憑', width: 18 },
    { key: 'remark', header: '備考', width: 30 },
  ]
  const rows: TableRow[] = []
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
      evidence: evidenceLink(e, origin),
      remark: e.remark,
    }
    if (!e.items.length) {
      rows.push({ values: { ...base, itemNumber: e.itemNumber, label: '（予算にない項目）', actual: e.amount } })
      continue
    }
    for (const i of e.items) {
      rows.push({
        values: {
          ...base,
          itemNumber: i.itemNumber,
          label: i.label,
          // 実際の数量・取引先（入力がなければ予算のもの）
          quantity: i.actualQuantity ?? i.quantity,
          vendor: i.actualVendor ?? i.vendor,
          budget: i.budgetAmount,
          actual: actualAmountOf(i, e),
        },
      })
    }
  }
  return { name: '執行一覧', columns, rows }
}
