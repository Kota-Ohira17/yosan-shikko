<script setup lang="ts">
/** 予算明細を検索して複数選ぶ。v-model は明細の key の配列 */
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

const LIMIT = 60
const results = computed(() => {
  const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return lines.value.filter((l) => {
    if (bureau.value && l.bureau !== bureau.value) return false
    const text = `${l.itemNumber} ${l.label} ${l.team} ${l.vendor} ${l.quantity}`.toLowerCase()
    return words.every(w => text.includes(w))
  })
})

function toggle(key: string) {
  current.value = current.value.includes(key)
    ? current.value.filter(k => k !== key)
    : [...current.value, key]
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
      <label>検索<input v-model="query" type="search" placeholder="例: インク / out-03-02 / ASKUL"></label>
      <label>局
        <select v-model="bureau">
          <option value="">すべて</option>
          <option v-for="b in bureaus" :key="b">{{ b }}</option>
        </select>
      </label>
    </div>

    <div class="results">
      <label v-for="l in results.slice(0, LIMIT)" :key="l.key" class="result" :class="{ on: current.includes(l.key) }">
        <input type="checkbox" :checked="current.includes(l.key)" @change="toggle(l.key)">
        <span class="label">
          <span class="num">{{ l.itemNumber }}</span> {{ l.label }}
          <small>{{ [l.team, l.vendor, l.quantity].filter(Boolean).join(' ・ ') }}</small>
        </span>
        <span class="yen">{{ formatYen(l.budgetAmount) }}</span>
      </label>
      <p v-if="!results.length" class="hint">該当する明細がありません。</p>
      <p v-else-if="results.length > LIMIT" class="hint">ほか {{ results.length - LIMIT }} 件。検索語を足して絞り込んでください。</p>
    </div>
  </div>
</template>

<style scoped>
.picker { display: grid; gap: .75rem; }
.picked { border: 1px solid var(--accent); border-radius: 6px; padding: .5rem .75rem; }
.picked-head { display: flex; justify-content: space-between; gap: 1rem; font-size: .9rem; margin-bottom: .25rem; }
.picked ul { list-style: none; margin: 0; padding: 0; display: grid; gap: .25rem; }
.picked li, .result { display: grid; grid-template-columns: 1fr auto auto; gap: .5rem; align-items: baseline; font-size: .88rem; }
.result { grid-template-columns: auto 1fr auto; padding: .35rem .5rem; border-radius: 4px; cursor: pointer; }
.result:hover { background: var(--bg); }
.result.on { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.results { max-height: 22rem; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; padding: .25rem; }
.num { font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap; margin-right: .25rem; }
.label { min-width: 0; overflow-wrap: anywhere; }
.label small { display: block; color: var(--muted); }
.yen { font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
</style>
