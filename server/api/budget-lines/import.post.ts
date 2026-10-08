/**
 * 本予算「支出」シートの CSV を取り込み、予算明細を全件入れ替える（財務局長・管理者のみ）。
 * 申請側は明細の内容をコピーして持っているので、入れ替えても過去の申請は変わらない。
 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'importBudget')
  const parts = (await readMultipartFormData(event)) ?? []
  const file = parts.find(p => p.name === 'file' && p.data.length > 0)
  if (!file) throw createError({ statusCode: 400, message: 'CSV ファイルを選んでください' })

  const lines = parseBudgetCsv(decodeCsv(file.data))
  if (!lines.length) {
    throw createError({ statusCode: 400, message: '金額の入った明細が見つかりませんでした。「支出」シートの CSV か確認してください' })
  }

  const db = useDb()
  const importedAt = new Date()
  const CHUNK = 100
  await db.batch([
    db.delete(schema.budgetLines),
    ...Array.from({ length: Math.ceil(lines.length / CHUNK) }, (_, i) =>
      db.insert(schema.budgetLines).values(lines.slice(i * CHUNK, (i + 1) * CHUNK).map(l => ({ ...l, importedAt }))),
    ),
  ] as const)

  return {
    count: lines.length,
    total: lines.reduce((s, l) => s + l.budgetAmount, 0),
    importedAt,
  }
})
