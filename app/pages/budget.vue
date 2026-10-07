<script setup lang="ts">
const { can } = usePermissions()
if (!can('importBudget')) await navigateTo('/')

const { data: lines, refresh } = await useBudgetLines()
const file = ref<File | null>(null)
const pending = ref(false)
const errors = ref<string[]>([])
const result = ref<{ count: number, total: number }>()

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
  try {
    result.value = await $fetch<{ count: number, total: number }>('/api/budget-lines/import', { method: 'POST', body: form })
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
        現在 <strong>{{ lines.length }}件</strong>の明細（合計 {{ formatYen(total) }}）。最終取り込み: {{ importedAt }}
      </p>
      <p v-else>まだ予算が取り込まれていません。</p>

      <ol class="steps">
        <li>本予算のスプレッドシートで「<strong>支出</strong>」シートを開く</li>
        <li>「ファイル → ダウンロード → カンマ区切り形式（.csv）」で保存する</li>
        <li>下で選んで取り込む（今の明細はすべて入れ替わります。過去の申請には影響しません）</li>
      </ol>

      <form @submit.prevent="onImport">
        <label>CSV ファイル<input type="file" accept=".csv,text/csv" required @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"></label>
        <ul v-if="errors.length" class="error"><li v-for="e in errors" :key="e">{{ e }}</li></ul>
        <p v-if="result" class="success">{{ result.count }}件の明細を取り込みました（合計 {{ formatYen(result.total) }}）。</p>
        <button type="submit" :disabled="pending || !file">{{ pending ? '取り込み中…' : '取り込む' }}</button>
      </form>
    </div>

    <template v-if="lines.length">
      <h2>明細一覧</h2>
      <input v-model="query" type="search" class="search" placeholder="絞り込み（項目番号・局・担当・名前・取引先）">
      <BudgetTable :lines="filtered" class="full" />
    </template>
  </section>
</template>

<style scoped>
.card { max-width: none; margin-bottom: 1.5rem; }
.steps { padding-left: 1.25rem; color: var(--muted); }
h2 { font-size: 1.1rem; }
.search { max-width: 420px; margin-bottom: .75rem; }
.full :deep(.sheet-wrap), .full { max-height: 70vh; }
</style>
