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
      <ul>
        <li v-for="l in selectedLines" :key="l.key">
          <span class="label"><span class="num">{{ l.itemNumber }}</span> {{ l.label }}</span>
          <span class="yen">{{ formatYen(l.budgetAmount) }}</span>
          <button type="button" class="link" :aria-label="`${l.label} を外す`" @click="toggle(l.key)">外す</button>
        </li>
      </ul>
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

    <BudgetTable v-if="filtered.length" :lines="filtered" :selected="current" @toggle="toggle" @toggle-many="toggleMany" />
    <p v-else class="hint">該当する明細がありません。</p>
    <p class="hint">金額の入っている行をクリックすると選択できます（複数可）。すぐ上の見出しの行（例:「インク代」）を押すと、その下の明細をまとめて選択・解除できます。</p>
  </div>
</template>

<style scoped>
.picker { display: grid; gap: .75rem; min-width: 0; }
.picked { border: 1px solid var(--accent); border-radius: 6px; padding: .5rem .75rem; }
.picked-head { display: flex; justify-content: space-between; gap: 1rem; font-size: .9rem; margin-bottom: .25rem; }
.picked ul { list-style: none; margin: 0; padding: 0; display: grid; gap: .25rem; }
.picked li { display: grid; grid-template-columns: 1fr auto auto; gap: .5rem; align-items: baseline; font-size: .88rem; }
.num { font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap; margin-right: .25rem; }
.label { min-width: 0; overflow-wrap: anywhere; }
.yen { font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
</style>
