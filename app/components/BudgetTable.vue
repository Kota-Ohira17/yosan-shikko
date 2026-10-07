<script setup lang="ts">
/**
 * 予算明細を本予算スプレッドシート「支出」シートと同じ形の表で表示する。
 * 局・担当・款・項・目は見出しの行として出し、金額のある行（明細）を選べるようにする。
 * 明細のすぐ上の見出し（例:「インク代」）を押すと、その下の明細をまとめて選択・解除できる。
 * selected を渡さなければ閲覧専用。
 */
const props = defineProps<{
  lines: BudgetLineView[]
  selected?: string[]
}>()
const emit = defineEmits<{
  toggle: [key: string]
  /** 見出しでまとめて選択（on=true）・解除（on=false） */
  toggleMany: [keys: string[], on: boolean]
}>()

type Col = 'number' | 'bureau' | 'team' | 'kan' | 'kou' | 'moku' | 'setsu'
interface Row {
  id: string
  kind: 'group' | 'line'
  level: Col
  cells: Partial<Record<Col, string>>
  line?: BudgetLineView
  /** 見出しの行: 局から自分までの階層をつないだもの（同じ見出しの判定に使う） */
  path?: string
}

/** まとめて選べる見出しの階層（局・担当は範囲が広すぎるので対象外） */
const GROUP_LEVELS: readonly Level[] = ['kan', 'kou', 'moku', 'setsu']

const LEVELS = ['bureau', 'team', 'kan', 'kou', 'moku', 'setsu'] as const
type Level = (typeof LEVELS)[number]

function value(l: BudgetLineView, level: Level) {
  switch (level) {
    case 'bureau': return l.bureau ? `${l.bureauNo}|${l.bureau}` : ''
    case 'team': return l.team
    case 'kan': return l.kan ? `${l.kanNo}|${l.kan}` : ''
    case 'kou': return l.kou ? `${l.kouNo}|${l.kou}` : ''
    case 'moku': return l.moku
    case 'setsu': return l.setsu
  }
}

function headerCells(l: BudgetLineView, level: Level): Row['cells'] {
  switch (level) {
    case 'bureau': return { number: l.bureauNo, bureau: l.bureau }
    case 'team': return { team: l.team }
    case 'kan': return { number: l.kanNo, kan: l.kan }
    case 'kou': return { number: l.kouNo, kou: l.kou }
    case 'moku': return { moku: l.moku }
    case 'setsu': return { setsu: l.setsu }
  }
}

/** 明細の行そのもの。名前はその行の階層の列に出す（数量だけの行は名前なし） */
function lineCells(l: BudgetLineView): Row['cells'] {
  switch (l.level) {
    case 'kan': return { number: l.kanNo, kan: l.kan }
    case 'kou': return { number: l.kouNo, kou: l.kou }
    case 'moku': return { moku: l.moku }
    case 'setsu': return { setsu: l.setsu }
    default: return {}
  }
}

const table = computed(() => {
  const rows: Row[] = []
  /** 見出し（path）→ そのすぐ下にある明細の key */
  const children = new Map<string, string[]>()
  /** 見出し（path）→ その下（孫以下も含む）の明細の数 */
  const descendants = new Map<string, number>()
  let prev: string[] = []
  for (const l of props.lines) {
    // この明細より上の階層（数量だけの行なら節まで）を見出しとして出す
    const own = l.level === 'none' ? LEVELS.length : LEVELS.indexOf(l.level)
    const prefixes: string[] = []
    let changed = false
    let parent: string | undefined
    LEVELS.forEach((level, i) => {
      prefixes[i] = `${prefixes[i - 1] ?? ''}/${value(l, level)}`
      if (i >= own || !value(l, level)) return
      if (GROUP_LEVELS.includes(level)) {
        parent = prefixes[i]
        descendants.set(prefixes[i]!, (descendants.get(prefixes[i]!) ?? 0) + 1)
      }
      if (!changed && prefixes[i] === prev[i]) return
      changed = true
      rows.push({ id: `g${rows.length}`, kind: 'group', level, cells: headerCells(l, level), path: prefixes[i] })
    })
    rows.push({ id: l.key, kind: 'line', level: l.level === 'none' ? 'setsu' : l.level, cells: lineCells(l), line: l })
    if (parent) children.set(parent, [...(children.get(parent) ?? []), l.key])
    prev = prefixes
  }
  return { rows, children, descendants }
})
const rows = computed(() => table.value.rows)

/**
 * 見出しの行の選択状態。まとめて選べるのは、下にあるのがすべて明細の見出し（明細のちょうど一つ上の層）だけ。
 * さらに見出しを含む見出し（例:「大判印刷機関連費」）は、押しても一部しか選ばれず紛らわしいので対象外。
 */
function groupState(row: Row) {
  const keys = row.path ? table.value.children.get(row.path) : undefined
  if (!selectable.value || !keys?.length || !GROUP_LEVELS.includes(row.level as Level)) return undefined
  if (table.value.descendants.get(row.path!) !== keys.length) return undefined
  const on = keys.filter(k => props.selected?.includes(k)).length
  return { keys, all: on === keys.length, some: on > 0 && on < keys.length }
}

function onRowClick(row: Row) {
  if (!selectable.value) return
  if (row.line) return emit('toggle', row.line.key)
  const g = groupState(row)
  if (g) emit('toggleMany', g.keys, !g.all)
}

const COLUMNS: { key: Col, label: string }[] = [
  { key: 'number', label: '項目番号' },
  { key: 'bureau', label: '局' },
  { key: 'team', label: '担当' },
  { key: 'kan', label: '款' },
  { key: 'kou', label: '項' },
  { key: 'moku', label: '目' },
  { key: 'setsu', label: '節' },
]

const selectable = computed(() => props.selected !== undefined)
const isOn = (row: Row) => row.line != null && (props.selected?.includes(row.line.key) ?? false)
</script>

<template>
  <div class="sheet-wrap">
    <table class="sheet">
      <thead>
        <tr>
          <th v-if="selectable" class="check" />
          <th v-for="c in COLUMNS" :key="c.key" :class="`c-${c.key}`">{{ c.label }}</th>
          <th class="c-qty">数量</th>
          <th class="c-vendor">取引先</th>
          <th class="yen">希望予算額</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.id"
          :class="[row.kind, `lv-${row.level}`, { on: isOn(row), pickable: row.line || groupState(row) }]"
          @click="onRowClick(row)"
        >
          <td v-if="selectable" class="check">
            <input
              v-if="row.line"
              type="checkbox"
              :checked="isOn(row)"
              :aria-label="row.line.label"
              @click.stop
              @change="emit('toggle', row.line.key)"
            >
            <input
              v-else-if="groupState(row)"
              type="checkbox"
              :checked="groupState(row)!.all"
              :indeterminate="groupState(row)!.some"
              :aria-label="`${Object.values(row.cells).filter(Boolean).at(-1)} の明細をまとめて選択`"
              title="この下の明細をまとめて選択"
              @click.stop
              @change="onRowClick(row)"
            >
          </td>
          <td v-for="c in COLUMNS" :key="c.key" :class="`c-${c.key}`">{{ row.cells[c.key] }}</td>
          <td>{{ row.line?.quantity }}</td>
          <td>{{ row.line?.vendor }}</td>
          <td class="yen">{{ row.line ? formatYen(row.line.budgetAmount) : '' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.sheet-wrap { max-height: 28rem; overflow: auto; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
.sheet { border-collapse: collapse; font-size: .8rem; width: 100%; min-width: 58rem; }
.sheet th, .sheet td { border: 1px solid var(--border); padding: .2rem .4rem; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
.sheet th { position: sticky; top: 0; z-index: 1; background: var(--bg); color: var(--muted); font-weight: 600; white-space: nowrap; }
/* 局・担当・款は見出しの行にしか出ないので狭く、明細の名前が出る項・目・節を広くする */
.sheet .c-number { width: 6.5rem; white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--muted); }
.sheet .c-bureau { width: 4rem; }
.sheet .c-team { width: 5rem; }
.sheet .c-kan { width: 7rem; }
.sheet .c-kou { width: 9rem; }
.sheet .c-moku, .sheet .c-setsu { width: 17%; }
.sheet .yen { width: 6.5rem; white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
.sheet .check { width: 2rem; text-align: center; }
.sheet .c-qty { width: 4.5rem; }
.sheet .c-vendor { width: 6rem; }

tr.group td { background: var(--bg); }
tr.group.lv-bureau td { font-weight: 700; background: color-mix(in srgb, var(--accent) 10%, var(--bg)); }
tr.group.lv-kan td, tr.group.lv-team td { font-weight: 600; }
tr.pickable { cursor: v-bind("selectable ? 'pointer' : 'default'"); }
tr.group.pickable:hover td { background: color-mix(in srgb, var(--accent) 6%, var(--bg)); }
tr.line:hover td { background: color-mix(in srgb, var(--accent) 6%, transparent); }
tr.line.on td { background: color-mix(in srgb, var(--accent) 16%, transparent); }
</style>
