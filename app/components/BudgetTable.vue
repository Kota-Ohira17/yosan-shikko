<script setup lang="ts">
/**
 * 予算明細を本予算スプレッドシート「支出」シートと同じ形の表で表示する。
 * 局・担当・款・項・目は見出しの行として出し、金額のある行（明細）を選べるようにする。
 * 款から下の見出し（例:「委員会設備等関連費」「インク代」）を押すと、その下の明細をすべてまとめて選択・解除できる。
 * selected を渡さなければ閲覧専用。行の組み立ては shared/budgetRows.ts（決算シートの出力と共通）。
 */
import {
  buildSheetRows, GROUP_LEVELS, LEVEL_LABELS, SHEET_COLUMN_LABELS, SHEET_COLUMNS, type SheetRow,
} from '#shared/budgetRows'

const props = defineProps<{
  lines: BudgetLineView[]
  selected?: string[]
}>()
const emit = defineEmits<{
  toggle: [key: string]
  /** 見出しでまとめて選択（on=true）・解除（on=false） */
  toggleMany: [keys: string[], on: boolean]
}>()

type Row = SheetRow<BudgetLineView>

const table = computed(() => buildSheetRows(props.lines))
const rows = computed(() => table.value.rows)

/** 見出しの行の選択状態（款から下の見出しは、その下の明細をすべてまとめて選べる） */
function groupState(row: Row) {
  const keys = row.path ? table.value.descendants.get(row.path) : undefined
  if (!selectable.value || !keys?.length || !GROUP_LEVELS.includes(row.level)) return undefined
  const on = keys.filter(k => props.selected?.includes(k)).length
  return { keys, all: on === keys.length, some: on > 0 && on < keys.length }
}

function onRowClick(row: Row) {
  if (!selectable.value) return
  if (row.line) return emit('toggle', row.line.key)
  const g = groupState(row)
  if (g) emit('toggleMany', g.keys, !g.all)
}

const COLUMNS = SHEET_COLUMNS.map(key => ({ key, label: SHEET_COLUMN_LABELS[key] }))

const selectable = computed(() => props.selected !== undefined)
const isOn = (row: Row) => row.line != null && (props.selected?.includes(row.line.key) ?? false)

/** 見出しにマウスを乗せている間、押したら選ばれる明細を光らせる */
const preview = ref<Set<string>>(new Set())
function onRowEnter(row: Row) {
  const g = row.line ? undefined : groupState(row)
  preview.value = g ? new Set(g.keys) : new Set()
}
</script>

<template>
  <div class="sheet-wrap" @mouseleave="preview = new Set()">
    <table class="sheet" :class="{ selectable }">
      <thead>
        <tr>
          <th v-if="selectable" class="check">選択</th>
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
          :class="[row.kind, `lv-${row.level}`, {
            on: isOn(row),
            pickable: row.line || groupState(row),
            preview: row.line && preview.has(row.line.key),
          }]"
          @click="onRowClick(row)"
          @mouseenter="onRowEnter(row)"
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
            <label v-else-if="groupState(row)" class="group-pick" @click.stop>
              <input
                type="checkbox"
                :checked="groupState(row)!.all"
                :indeterminate="groupState(row)!.some"
                :aria-label="`${LEVEL_LABELS[row.level]}「${Object.values(row.cells).filter(Boolean).at(-1)}」の明細${groupState(row)!.keys.length}件をまとめて選択`"
                @change="onRowClick(row)"
              >
              <span class="lv-badge">{{ LEVEL_LABELS[row.level] }}</span>
              <span class="count" :title="`この${LEVEL_LABELS[row.level]}の下の明細 ${groupState(row)!.keys.length}件`">{{ groupState(row)!.keys.length }}</span>
            </label>
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
.sheet-wrap {
  max-height: 28rem; overflow: auto; border: 1px solid var(--border); border-radius: 6px; background: var(--surface);
  /* 階層ごとの色。上の階層ほど濃い（BudgetPicker の凡例と同じ） */
  --lv-bureau: color-mix(in srgb, var(--accent) 24%, var(--surface));
  --lv-kan: color-mix(in srgb, var(--accent) 16%, var(--surface));
  --lv-kou: color-mix(in srgb, var(--accent) 9%, var(--surface));
  --lv-moku: color-mix(in srgb, var(--accent) 4%, var(--surface));
  --lv-setsu: color-mix(in srgb, var(--accent) 2%, var(--surface));
  --stripe-kan: var(--accent);
  --stripe-kou: color-mix(in srgb, var(--accent) 60%, var(--surface));
  --stripe-moku: color-mix(in srgb, var(--accent) 35%, var(--surface));
  --stripe-setsu: color-mix(in srgb, var(--accent) 18%, var(--surface));
}
.sheet { border-collapse: collapse; font-size: .8rem; width: 100%; min-width: 58rem; }
.sheet th, .sheet td { border: 1px solid var(--border); padding: .2rem .4rem; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
.sheet th { position: sticky; top: 0; z-index: 1; background: var(--bg); color: var(--muted); font-weight: 600; white-space: nowrap; }
/* 局・担当・款は見出しの行にしか出ないので狭く、明細の名前が出る項・目・節を広くする */
.sheet .c-number { width: 6rem; white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--muted); }
.sheet .c-bureau { width: 4.2rem; }
.sheet .c-team { width: 5.4rem; }
.sheet .c-kan { width: 8rem; }
.sheet .c-kou { width: 10.5rem; }
.sheet .c-moku, .sheet .c-setsu { width: 17%; }
.sheet .yen { width: 6.5rem; white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
.sheet .check { width: 4.6rem; white-space: nowrap; }
.sheet .c-qty { width: 4.5rem; }
.sheet .c-vendor { width: 6rem; }

/* 見出しの行: 階層ごとに背景の濃さと文字の太さ、左端の線の色を変える */
tr.group td { background: var(--bg); }
tr.group.lv-bureau td { background: var(--lv-bureau); font-weight: 700; font-size: .85rem; }
tr.group.lv-team td { background: var(--bg); font-weight: 600; }
tr.group.lv-kan td { background: var(--lv-kan); font-weight: 700; border-top: 2px solid var(--stripe-kan); }
tr.group.lv-kou td { background: var(--lv-kou); font-weight: 600; }
tr.group.lv-moku td { background: var(--lv-moku); font-weight: 500; }
tr.group.lv-setsu td { background: var(--lv-setsu); }
tr.group.lv-kan > td:first-child { box-shadow: inset 5px 0 0 var(--stripe-kan); }
tr.group.lv-kou > td:first-child { box-shadow: inset 5px 0 0 var(--stripe-kou); }
tr.group.lv-moku > td:first-child { box-shadow: inset 5px 0 0 var(--stripe-moku); }
tr.group.lv-setsu > td:first-child { box-shadow: inset 5px 0 0 var(--stripe-setsu); }

/* まとめて選ぶチェックボックスと、階層名・件数のバッジ */
.group-pick { display: inline-flex; align-items: center; gap: .25rem; cursor: pointer; padding-left: .3rem; }
.lv-badge {
  display: inline-block; min-width: 1.4em; padding: 0 .3em; border-radius: 3px; text-align: center;
  font-size: .72rem; font-weight: 700; line-height: 1.5; color: #fff; background: var(--stripe-kan);
}
tr.lv-kou .lv-badge { background: var(--stripe-kou); color: var(--text); }
tr.lv-moku .lv-badge { background: var(--stripe-moku); color: var(--text); }
tr.lv-setsu .lv-badge { background: var(--stripe-setsu); color: var(--text); }
.count { font-size: .72rem; color: var(--muted); font-variant-numeric: tabular-nums; }
tr.line .check { padding-left: .7rem; }

.selectable tr.pickable { cursor: pointer; }
.selectable tr.group.pickable:hover td { filter: brightness(.97); }
.selectable tr.line:hover td { background: color-mix(in srgb, var(--accent) 6%, transparent); }
/* 見出しにマウスを乗せたとき、まとめて選ばれる明細 */
tr.line.preview td { background: color-mix(in srgb, var(--accent) 9%, transparent); }
tr.line.preview > td:first-child { box-shadow: inset 3px 0 0 var(--accent); }
tr.line.on td { background: color-mix(in srgb, var(--accent) 18%, transparent); }
</style>
