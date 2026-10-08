<script setup lang="ts">
/** 予算明細をスプレッドシートと同じ形の表から複数選ぶ。v-model は明細の key の配列 */
const selected = defineModel<string[]>({ required: true })
const { data: lines } = await useBudgetLines()

const query = ref('')
const bureau = ref('')
const bureaus = computed(() => [...new Set(lines.value.map(l => l.bureau).filter(Boolean))])

// 親への反映（v-model）は次の描画まで遅れるので、素早く続けて押しても取りこぼさないよう手元にも持つ
const current = ref<string[]>([...selected.value])
watch(selected, (v) => { current.value = [...v] })

const byKey = computed(() => new Map(lines.value.map(l => [l.key, l])))
const selectedLines = computed(() => current.value.map(k => byKey.value.get(k)).filter(l => l != null))
const selectedTotal = computed(() => selectedLines.value.reduce((s, l) => s + l.budgetAmount, 0))

/**
 * 選択中の明細を款ごとにまとめ、款の下の階層（項 › 目）を添えて表示する。
 * 款でまとめて選んだのか、項・目の一部を選んだのかが分かるように。
 */
const selectedByKan = computed(() => {
  const groups = Map.groupBy(
    [...selectedLines.value].sort((a, b) => a.sortOrder - b.sortOrder),
    l => `${l.kanNo}|${l.kan}`,
  )
  return [...groups.values()].map((items) => {
    const first = items[0]!
    const inKan = lines.value.filter(l => l.kanNo === first.kanNo && l.kan === first.kan).length
    return {
      key: `${first.kanNo}|${first.kan}`,
      kanNo: first.kanNo,
      kan: first.kan || first.label.split(' / ')[0],
      whole: items.length === inKan,
      inKan,
      total: items.reduce((s, l) => s + l.budgetAmount, 0),
      items: items.map((l) => {
        const parts = l.label.split(' / ')
        // ラベルの先頭は「項（なければ款）」。款は見出しに出すので重ねない
        const trail = parts.slice(0, -1).filter(p => p !== first.kan)
        return { line: l, trail, name: parts.at(-1)! }
      }),
    }
  })
})

const filtered = computed(() => {
  const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return lines.value.filter((l) => {
    if (bureau.value && l.bureau !== bureau.value) return false
    const text = `${l.itemNumber} ${l.label} ${l.kan} ${l.team} ${l.vendor} ${l.quantity}`.toLowerCase()
    return words.every(w => text.includes(w))
  })
})

function toggle(key: string) {
  current.value = current.value.includes(key)
    ? current.value.filter(k => k !== key)
    : [...current.value, key]
  selected.value = current.value
}

function toggleMany(keys: string[], on: boolean) {
  current.value = on
    ? [...current.value, ...keys.filter(k => !current.value.includes(k))]
    : current.value.filter(k => !keys.includes(k))
  selected.value = current.value
}
</script>

<template>
  <div class="picker">
    <div v-if="selectedLines.length" class="picked">
      <div class="picked-head">
        <strong>選択中 {{ selectedLines.length }}件</strong>
        <span>予算額 合計 {{ formatYen(selectedTotal) }}</span>
      </div>
      <section v-for="g in selectedByKan" :key="g.key" class="kan-group">
        <header class="kan-head">
          <span class="lv-badge kan">款</span>
          <span class="num">{{ g.kanNo }}</span>
          <strong class="kan-name">{{ g.kan }}</strong>
          <span class="scope" :class="{ whole: g.whole }">{{ g.whole ? `款ごと（全${g.inKan}件）` : `${g.items.length} / ${g.inKan}件` }}</span>
          <span class="yen">{{ formatYen(g.total) }}</span>
          <button type="button" class="link" :aria-label="`款「${g.kan}」の選択をすべて外す`" @click="toggleMany(g.items.map(i => i.line.key), false)">まとめて外す</button>
        </header>
        <ul>
          <li v-for="i in g.items" :key="i.line.key">
            <span class="label">
              <span class="num">{{ i.line.itemNumber }}</span>
              <span v-if="i.trail.length" class="trail">{{ i.trail.join(' › ') }} › </span>
              <span class="name">{{ i.name }}</span>
            </span>
            <span class="yen">{{ formatYen(i.line.budgetAmount) }}</span>
            <button type="button" class="link" :aria-label="`${i.line.label} を外す`" @click="toggle(i.line.key)">外す</button>
          </li>
        </ul>
      </section>
    </div>

    <div class="row">
      <label>絞り込み<input v-model="query" type="search" placeholder="例: インク / out-03-02 / ASKUL"></label>
      <label>局
        <select v-model="bureau">
          <option value="">すべて</option>
          <option v-for="b in bureaus" :key="b">{{ b }}</option>
        </select>
      </label>
    </div>

    <div class="legend" aria-label="階層の見方">
      <span>階層：</span>
      <span class="legend-item"><span class="lv-badge kan">款</span></span>
      <span class="sep">›</span>
      <span class="legend-item"><span class="lv-badge kou">項</span></span>
      <span class="sep">›</span>
      <span class="legend-item"><span class="lv-badge moku">目</span></span>
      <span class="sep">›</span>
      <span class="legend-item"><span class="lv-badge setsu">節</span></span>
      <span class="sep">›</span>
      <span class="legend-item"><span class="leaf-swatch" />明細（金額のある行）</span>
    </div>

    <BudgetTable v-if="filtered.length" :lines="filtered" :selected="current" @toggle="toggle" @toggle-many="toggleMany" />
    <p v-else class="hint">該当する明細がありません。</p>
    <p class="hint">
      明細の行をクリックすると1件ずつ選べます。款・項・目・節の見出しのチェックボックスは、その下の明細をすべてまとめて選択・解除します
      （横の数字が対象の件数。マウスを乗せると対象の明細が色付きで表示されます）。
    </p>
  </div>
</template>

<style scoped>
.picker { display: grid; gap: .75rem; min-width: 0; }
.picker {
  --stripe-kan: var(--accent);
  --stripe-kou: color-mix(in srgb, var(--accent) 60%, var(--surface));
  --stripe-moku: color-mix(in srgb, var(--accent) 35%, var(--surface));
  --stripe-setsu: color-mix(in srgb, var(--accent) 18%, var(--surface));
}
.picked { border: 1px solid var(--accent); border-radius: 6px; padding: .5rem .75rem; display: grid; gap: .5rem; }
.picked-head { display: flex; justify-content: space-between; gap: 1rem; font-size: .9rem; }
.kan-group { border-left: 4px solid var(--stripe-kan); padding-left: .6rem; }
.kan-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: .4rem; font-size: .88rem; padding: .15rem 0; }
.kan-name { flex: 1 1 8rem; }
.scope { font-size: .75rem; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 0 .5em; }
.scope.whole { color: var(--accent); border-color: var(--accent); font-weight: 600; }
.picked ul { list-style: none; margin: 0; padding: 0 0 0 .4rem; display: grid; gap: .15rem; border-left: 1px dashed var(--border); }
.picked li { display: grid; grid-template-columns: 1fr auto auto; gap: .5rem; align-items: baseline; font-size: .85rem; padding-left: .5rem; }
.trail { color: var(--muted); }
.name { font-weight: 500; }
.num { font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap; margin-right: .3rem; }
.label { min-width: 0; overflow-wrap: anywhere; }
.yen { font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }

.lv-badge {
  display: inline-block; min-width: 1.4em; padding: 0 .3em; border-radius: 3px; text-align: center;
  font-size: .72rem; font-weight: 700; line-height: 1.5; color: #fff; background: var(--stripe-kan);
}
.lv-badge.kou { background: var(--stripe-kou); color: var(--text); }
.lv-badge.moku { background: var(--stripe-moku); color: var(--text); }
.lv-badge.setsu { background: var(--stripe-setsu); color: var(--text); }
.legend { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem; font-size: .78rem; color: var(--muted); }
.legend-item { display: inline-flex; align-items: center; gap: .3rem; }
.sep { color: var(--border); }
.leaf-swatch { display: inline-block; width: 1.4em; height: 1em; border: 1px solid var(--border); background: var(--surface); border-radius: 2px; }
</style>
