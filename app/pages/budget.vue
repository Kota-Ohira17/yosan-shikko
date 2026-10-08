<script setup lang="ts">
const { can } = usePermissions()
if (!can('importBudget')) await navigateTo('/')

const { data: lines, refresh } = await useBudgetLines()
const file = ref<File | null>(null)
/** 取り込む予算の種類（auto は CSV から推測） */
const kind = ref<'auto' | 'main' | 'revised'>('auto')
const budgetKind = useBudgetKind()
const pending = ref(false)
const errors = ref<string[]>([])
const result = ref<{ count: number, total: number, budgetKind: string }>()

const importedAt = computed(() => {
  const t = lines.value[0]?.importedAt
  return t ? new Date(t).toLocaleString('ja-JP') : ''
})
const total = computed(() => lines.value.reduce((s, l) => s + l.budgetAmount, 0))

async function onImport() {
  if (!file.value) return
  errors.value = []
  result.value = undefined
  pending.value = true
  const form = new FormData()
  form.append('file', file.value)
  form.append('kind', kind.value)
  try {
    result.value = await $fetch<{ count: number, total: number, budgetKind: string }>('/api/budget-lines/import', { method: 'POST', body: form })
    await refresh()
  }
  catch (error) {
    errors.value = toMessages(error)
  }
  finally {
    pending.value = false
  }
}

const query = ref('')
const filtered = computed(() => {
  const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return lines.value.filter((l) => {
    const text = `${l.itemNumber} ${l.bureau} ${l.team} ${l.kan} ${l.label} ${l.vendor}`.toLowerCase()
    return words.every(w => text.includes(w))
  })
})
</script>

<template>
  <section>
    <h1>予算の取り込み</h1>

    <div class="card">
      <p v-if="lines.length">
        現在は<strong>{{ budgetKind }}</strong>の <strong>{{ lines.length }}件</strong>の明細（合計 {{ formatYen(total) }}）。最終取り込み: {{ importedAt }}
      </p>
      <p v-else>まだ予算が取り込まれていません。</p>

      <ol class="steps">
        <li>本予算または補正予算のスプレッドシートで「<strong>支出</strong>」シートを開く</li>
        <li>「ファイル → ダウンロード → カンマ区切り形式（.csv）」で保存する</li>
        <li>下で選んで取り込む（今の明細はすべて入れ替わります。過去の申請には影響しません）</li>
      </ol>
      <p class="hint">
        「項目番号」と「希望予算額」（または「予算額」）の見出しがある行を探して読み込みます。本予算・補正予算のどちらの形でも読み込めます。Excel で保存し直した CSV（Shift_JIS）も読み込めます。
      </p>

      <form @submit.prevent="onImport">
        <fieldset class="kind">
          <legend>予算の種類</legend>
          <label class="check"><input v-model="kind" type="radio" value="auto"> 自動で判定する（シート名の「補正」や列名から）</label>
          <label class="check"><input v-model="kind" type="radio" value="main"> 本予算</label>
          <label class="check"><input v-model="kind" type="radio" value="revised"> 補正予算</label>
        </fieldset>
        <label>CSV ファイル<input type="file" accept=".csv,text/csv" required @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"></label>
        <ul v-if="errors.length" class="error"><li v-for="e in errors" :key="e">{{ e }}</li></ul>
        <p v-if="result" class="success">{{ result.budgetKind }}として{{ result.count }}件の明細を取り込みました（合計 {{ formatYen(result.total) }}）。</p>
        <button type="submit" :disabled="pending || !file">{{ pending ? '取り込み中…' : '取り込む' }}</button>
      </form>
    </div>

    <template v-if="lines.length">
      <h2>明細一覧</h2>
      <input v-model="query" type="search" class="search" placeholder="絞り込み（項目番号・局・担当・名前・取引先）">
      <BudgetTable :lines="filtered" fixed-height />
    </template>
  </section>
</template>

<style scoped>
.card { max-width: none; margin-bottom: 1.5rem; }
.kind { display: flex; flex-wrap: wrap; gap: .4rem 1.2rem; }
.steps { padding-left: 1.25rem; color: var(--muted); }
h2 { font-size: 1.1rem; }
.search { max-width: 420px; margin-bottom: .75rem; }
</style>
