import ExcelJS from 'exceljs'
import type { Table } from '../utils/settlement'

/** 決算シート（Excel）。中身は server/utils/settlement.ts（スプレッドシート出力と共通） */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'exportSettlement')
  const tables = await buildSettlementTables(getRequestURL(event).origin)

  const wb = new ExcelJS.Workbook()
  wb.creator = '財務管理システム'
  wb.created = new Date()
  for (const t of tables) writeTable(wb, t)

  const buffer = await wb.xlsx.writeBuffer()
  const stamp = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).replaceAll('-', '')
  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="settlement_${stamp}.xlsx"; filename*=UTF-8''${encodeURIComponent(`決算_${stamp}.xlsx`)}`,
    'Cache-Control': 'private, no-store',
  })
  return Buffer.from(buffer)
})

const NUM_FMT = { yen: '#,##0;[Red]-#,##0', rate: '0.0%', date: 'yyyy/mm/dd' } as const

function writeTable(wb: ExcelJS.Workbook, table: Table) {
  const ws = wb.addWorksheet(table.name, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = table.columns.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width,
    style: c.format ? { numFmt: NUM_FMT[c.format] } : undefined,
  }))
  const head = ws.getRow(1)
  head.font = { bold: true }
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HEADER_FILL}` } }
  head.border = { bottom: { style: 'thin' } }

  for (const row of table.rows) {
    const values = Object.fromEntries(Object.entries(row.values).map(([k, v]) => [
      k,
      v && typeof v === 'object' && 'url' in v ? { text: v.text, hyperlink: v.url } : v,
    ]))
    const r = ws.addRow(values)
    if (row.bold) r.font = { bold: true }
    if (row.fill) {
      // シートと同じく、塗り始める列から右だけを塗る
      const from = row.fillFrom ? table.columns.findIndex(c => c.key === row.fillFrom) : 0
      for (let ci = Math.max(from, 0); ci < table.columns.length; ci++) {
        r.getCell(ci + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${row.fill}` } }
      }
    }
    if (row.topBorder) r.border = { top: { style: 'double' } }
    // リンクのセルは青字・下線
    table.columns.forEach((c, i) => {
      const v = row.values[c.key]
      if (v && typeof v === 'object' && 'url' in v) r.getCell(i + 1).font = { color: { argb: 'FF0B6BCB' }, underline: true }
    })
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: table.columns.length } }
}
