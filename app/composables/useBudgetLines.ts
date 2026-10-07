/** 予算明細（全件）。フォームと選択部品で同じデータを共有する */
export function useBudgetLines() {
  return useFetch('/api/budget-lines', { key: 'budget-lines', default: () => [] })
}

export type BudgetLineView = NonNullable<ReturnType<typeof useBudgetLines>['data']['value']>[number]

export const formatYen = (n: number | null | undefined) =>
  n == null ? '' : `${n < 0 ? '-' : ''}¥${Math.abs(n).toLocaleString('ja-JP')}`

/** 執行項目を選んだとき、局が未入力なら最初の明細の局を入れる */
export function useBureauFromItems(keys: Ref<string[]>, department: Ref<string>) {
  const { data: lines } = useBudgetLines()
  watch(keys, (k) => {
    if (department.value || !k.length) return
    department.value = lines.value.find(l => l.key === k[0])?.bureau ?? ''
  })
}

/** 選んだ明細から支出項目名を作る（例: 「インク代 / PFIー120M マゼンタ ほか1件」） */
export function itemNameFromLines(lines: BudgetLineView[]) {
  if (!lines.length) return ''
  const last = (l: BudgetLineView) => l.label.split(' / ').slice(-2).join(' / ')
  return lines.length === 1 ? last(lines[0]!) : `${last(lines[0]!)} ほか${lines.length - 1}件`
}
