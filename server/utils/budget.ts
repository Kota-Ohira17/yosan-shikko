/**
 * 本予算スプレッドシート「支出」シートの CSV を明細の配列にする。
 *
 * シートは 局 → 担当 → 款(out-03-02) → 項(out-03-02-06) → 目 → 節 の階層を行で表していて、
 * 「希望予算額」が入っている行が執行対象の明細。上の行の 款・項・目・節 を引き継いで名前を作る。
 * 列は見出し名で探すので、列の並びが変わっても動く。
 */

const COLUMNS = {
  number: '項目番号',
  bureau: '局',
  team: '担当',
  kan: '款',
  kou: '項',
  moku: '目',
  setsu: '節',
  quantity: '数量',
  vendor: '取引先',
  amount: '希望予算額',
  link: 'リンク',
  plannedTiming: '執行予定時期',
  remark: '備考',
} as const

/** 金額が入っていた行が、どの階層の名前を持つ行だったか（none は数量だけの行） */
export type BudgetLevel = 'kan' | 'kou' | 'moku' | 'setsu' | 'none'

export interface ParsedBudgetLine {
  key: string
  sortOrder: number
  itemNumber: string
  bureauNo: string
  bureau: string
  team: string
  // スプレッドシートと同じ表を組み立てるための階層（kouNo はシートに書かれている番号そのもの）
  kanNo: string
  kan: string
  kouNo: string
  kou: string
  moku: string
  setsu: string
  level: BudgetLevel
  label: string
  quantity: string
  vendor: string
  budgetAmount: number
  link: string
  plannedTiming: string
  remark: string
}

const MONEY = /^-?[¥￥]?-?[\d,]+$/

function parseMoney(value: string) {
  const v = value.replace(/\s/g, '')
  if (!v || !MONEY.test(v) || !/\d/.test(v)) return null
  const n = Number(v.replace(/[¥￥,]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function parseBudgetCsv(text: string): ParsedBudgetLine[] {
  const rows = parseCsv(text)
  const headerIndex = rows.findIndex(r => r.includes(COLUMNS.number) && r.includes(COLUMNS.amount))
  if (headerIndex < 0) {
    throw createError({ statusCode: 400, message: '「項目番号」「希望予算額」の見出し行が見つかりません。「支出」シートの CSV を選んでください' })
  }
  const header = rows[headerIndex]!
  const col = Object.fromEntries(
    Object.entries(COLUMNS).map(([k, name]) => [k, header.indexOf(name)]),
  ) as Record<keyof typeof COLUMNS, number>
  const get = (row: string[], k: keyof typeof COLUMNS) => (col[k] >= 0 ? (row[col[k]] ?? '').trim() : '')

  const ctx = { bureauNo: '', bureau: '', team: '', kanNo: '', kan: '', kouNo: '', kouRawNo: '', kou: '', moku: '', setsu: '' }
  /** 款・項・目・節の行に書かれた取引先（下の明細に引き継ぐ） */
  const vendors = { kan: '', kou: '', moku: '', setsu: '' }
  const lines: ParsedBudgetLine[] = []
  const seen = new Map<string, number>()

  for (const row of rows.slice(headerIndex + 1)) {
    const number = get(row, 'number')
    const bureau = get(row, 'bureau')
    const team = get(row, 'team')
    const kan = get(row, 'kan')
    const kou = get(row, 'kou')
    const moku = get(row, 'moku')
    const setsu = get(row, 'setsu')

    const empty = { kanNo: '', kan: '', kouNo: '', kouRawNo: '', kou: '', moku: '', setsu: '' }
    if (bureau) Object.assign(ctx, { ...empty, bureauNo: number, bureau, team: '' })
    if (team) Object.assign(ctx, { ...empty, team })
    if (kan) Object.assign(ctx, { ...empty, kanNo: number, kan })
    // 項目番号のない項は款の番号を使う
    if (kou) Object.assign(ctx, { kouNo: number || ctx.kanNo, kouRawNo: number, kou, moku: '', setsu: '' })
    if (moku) Object.assign(ctx, { moku, setsu: '' })
    // 目の行の「節」列に金額が入っているのは小計なので名前として扱わない
    const setsuName = setsu && parseMoney(setsu) === null ? setsu : ''
    if (setsuName) ctx.setsu = setsuName

    // 取引先は款・項・目の行にまとめて書かれ、下の明細の行は空欄のことが多いので引き継ぐ
    const vendor = get(row, 'vendor')
    if (bureau || team) vendors.kan = vendors.kou = vendors.moku = vendors.setsu = ''
    if (kan) Object.assign(vendors, { kan: vendor, kou: '', moku: '', setsu: '' })
    if (kou) Object.assign(vendors, { kou: vendor, moku: '', setsu: '' })
    if (moku) Object.assign(vendors, { moku: vendor, setsu: '' })
    if (setsuName) vendors.setsu = vendor

    const amount = parseMoney(get(row, 'amount'))
    if (amount === null) continue

    const itemNumber = ctx.kouNo || ctx.kanNo
    if (!itemNumber) continue
    const quantity = get(row, 'quantity')
    const label = [ctx.kou || ctx.kan, ctx.moku, ctx.setsu].filter(Boolean).join(' / ')
    const level: BudgetLevel = setsuName ? 'setsu' : moku ? 'moku' : kou ? 'kou' : kan ? 'kan' : 'none'
    // 名前の列が空で数量だけ違う行（「1パック」「3パック」など）を区別する
    const nameless = level === 'none'

    let key = `${itemNumber}|${label}|${nameless ? quantity : ''}`
    const dup = seen.get(key) ?? 0
    seen.set(key, dup + 1)
    if (dup) key += `#${dup + 1}`

    lines.push({
      key,
      sortOrder: lines.length,
      itemNumber,
      bureauNo: ctx.bureauNo,
      bureau: ctx.bureau,
      team: ctx.team,
      kanNo: ctx.kanNo,
      kan: ctx.kan,
      kouNo: ctx.kouRawNo,
      kou: ctx.kou,
      moku: ctx.moku,
      setsu: ctx.setsu,
      level,
      label: nameless && quantity ? `${label}（${quantity}）` : label,
      quantity,
      vendor: vendor || vendors.setsu || vendors.moku || vendors.kou || vendors.kan,
      budgetAmount: amount,
      link: get(row, 'link'),
      plannedTiming: get(row, 'plannedTiming'),
      remark: get(row, 'remark'),
    })
  }

  // 同じ名前の明細（数量違い・取引先違いなど）は、選ぶときに区別できるよう名前に添える
  const byLabel = Map.groupBy(lines, l => `${l.itemNumber}|${l.label}`)
  for (const group of byLabel.values()) {
    if (group.length < 2) continue
    const hints: ((l: ParsedBudgetLine) => string)[] = [
      l => l.quantity,
      l => l.vendor,
      l => `¥${l.budgetAmount.toLocaleString('ja-JP')}`,
    ]
    // グループ内で値がすべて異なる列を使う
    const hint = hints.find(h => new Set(group.map(h)).size === group.length && group.every(h)) ?? hints[2]!
    for (const l of group) {
      if (!l.label.endsWith(`（${hint(l)}）`)) l.label += `（${hint(l)}）`
    }
  }
  return lines
}

/** RFC 4180 の CSV（セル内の改行・"" エスケープ対応）。先頭の BOM は無視する */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    }
    else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}
