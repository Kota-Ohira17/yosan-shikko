<script setup lang="ts">
import { TRANSFER_BANKS, VIEWS, type ViewKey } from '#shared/constants'

const { can, entriesTitle } = usePermissions()
const route = useRoute()
const router = useRouter()

const view = computed<ViewKey>({
  get: () => (String(route.query.view ?? 'time') in VIEWS ? route.query.view : 'time') as ViewKey,
  set: v => router.replace({ query: { view: v } }),
})
const { data: entries, refresh } = await useFetch('/api/entries', { query: { view } })

const opened = ref<number>()
const exec = reactive({ bank: 'SMBC' as (typeof TRANSFER_BANKS)[number], amount: '', quantity: '' })
const execErrors = ref<string[]>([])

type Row = NonNullable<typeof entries.value>[number]

const DETAIL_LABELS: Record<string, string> = {
  budgetChange: '補正予算からの変更',
  site: '通販サイト',
  url: '商品ページのリンク',
  deliveryPlace: '配達場所',
  purchase: '購入先',
  paperReceipt: '紙の領収証',
  details: '詳細',
  otherMethod: '執行形態（その他）',
  kindOfEvidence: '証憑の種類',
  refundTiming: '返金時期',
  bankName: '金融機関名',
  branchName: '支店名',
  accountType: '口座種別',
  accountNumber: '口座番号',
  accountName: '口座名義',
}

function detailRows(row: Row) {
  const { bank, ...rest } = row.details as Record<string, unknown>
  return Object.entries({ ...rest, ...(bank as object | undefined) })
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => ({ label: DETAIL_LABELS[k] ?? k, value: String(v), isUrl: k === 'url' }))
}

/** 商品ページのリンク（改行・空白区切りで複数あり得る） */
const splitLinks = (v: string) => v.split(/\s+/).filter(Boolean)
const isLink = (u: string) => /^https?:\/\//.test(u)

const yen = (n: number | null) => (n == null ? '' : `${n.toLocaleString('ja-JP')}円`)
const dateTime = (s: string | Date | null) => (s ? new Date(s).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' }) : '')

/** 明細ごとの執行額の編集中の値（entry_items の id → 入力値） */
const itemDrafts = reactive<Record<number, string>>({})
const itemsSaved = ref(false)

function toggle(row: Row) {
  opened.value = opened.value === row.id ? undefined : row.id
  exec.amount = row.amount ? String(row.amount) : ''
  exec.quantity = row.quantity ?? ''
  execErrors.value = []
  itemsSaved.value = false
  for (const i of row.items) itemDrafts[i.id] = i.actualAmount == null ? '' : String(i.actualAmount)
}

const itemsChanged = (row: Row) =>
  row.items.some(i => (itemDrafts[i.id] ?? '') !== (i.actualAmount == null ? '' : String(i.actualAmount)))

const itemsActualTotal = (row: Row) => row.items.reduce((s, i) => s + (i.actualAmount ?? 0), 0)

function diff(budget: number, actual: number | null) {
  if (actual == null || actual === budget) return ''
  const d = actual - budget
  return `${d > 0 ? '+' : '-'}¥${Math.abs(d).toLocaleString('ja-JP')}`
}

async function saveItems(row: Row) {
  const amounts = Object.fromEntries(row.items.map(i => [i.id, itemDrafts[i.id] === '' ? null : Math.trunc(Number(itemDrafts[i.id]))]))
  await $fetch(`/api/entries/${row.id}/items`, { method: 'PATCH', body: { amounts } })
}

async function onSaveItems(row: Row) {
  execErrors.value = []
  itemsSaved.value = false
  try {
    await saveItems(row)
    await refresh()
    itemsSaved.value = true
  }
  catch (error) {
    execErrors.value = toMessages(error)
  }
}

async function setDone(row: Row, done: boolean) {
  execErrors.value = []
  try {
    // 対応済みにするときは、直した執行額も一緒に保存する（申請の金額は明細の合計になる）
    if (done && itemsChanged(row)) await saveItems(row)
    await $fetch(`/api/entries/${row.id}/execute`, {
      method: 'POST',
      body: {
        done,
        bank: row.type === '振込' && row.kind === 'execution' ? exec.bank : undefined,
        amount: !row.items.length && exec.amount ? Number(exec.amount) : undefined,
        quantity: exec.quantity || undefined,
      },
    })
    await refresh()
  }
  catch (error) {
    execErrors.value = toMessages(error)
  }
}
</script>

<template>
  <section>
    <div class="page-head">
      <h1>{{ entriesTitle }}</h1>
      <a v-if="can('viewAllEntries')" class="button" href="/api/settlement.xlsx" download>決算シートを出力（Excel）</a>
    </div>

    <nav class="tabs">
      <button
        v-for="(label, key) in VIEWS"
        :key="key"
        :class="{ active: view === key }"
        @click="view = key"
      >
        {{ label }}
      </button>
    </nav>

    <p v-if="!entries?.length" class="empty">該当する申請はありません。</p>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>番号</th><th>申請日</th><th>項目番号</th><th>支出項目</th><th>数量</th>
            <th>金額</th><th>形態</th><th>期限・予定日</th><th>申請者</th><th>状態</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in entries" :key="row.id">
            <tr class="clickable" :class="{ done: row.status === 'done' }" @click="toggle(row)">
              <td>{{ row.seq }}</td>
              <td>{{ dateTime(row.createdAt) }}</td>
              <td>{{ row.itemNumber }}</td>
              <td>{{ row.itemName }}</td>
              <td>{{ row.quantity }}</td>
              <td class="num">{{ yen(row.amount) }}</td>
              <td>{{ row.paymentMethod ?? row.type }}</td>
              <td>{{ row.deadline }}</td>
              <td>{{ row.applicantName }}<small>（{{ row.department }}/{{ row.inCharge }}）</small></td>
              <td>
                <span class="badge" :class="row.status">{{ row.status === 'done' ? `対応済 ${dateTime(row.executedAt)}` : '未対応' }}</span>
              </td>
            </tr>
            <tr v-if="opened === row.id" class="detail">
              <td colspan="10">
                <div v-if="row.items.length" class="items">
                  <strong>予算明細（{{ row.items.length }}件）</strong>
                  <table class="items-table">
                    <thead>
                      <tr><th>項目番号</th><th>明細</th><th class="num">予算額</th><th class="num">執行額</th><th class="num">予算比</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="i in row.items" :key="i.id">
                        <td class="muted">{{ i.itemNumber }}</td>
                        <td>{{ i.label }}</td>
                        <td class="num">{{ formatYen(i.budgetAmount) }}</td>
                        <td class="num">
                          <input
                            v-if="can('executeEntries')"
                            v-model="itemDrafts[i.id]"
                            type="number"
                            step="1"
                            placeholder="未入力"
                            :aria-label="`${i.label} の執行額`"
                          >
                          <template v-else>{{ i.actualAmount == null ? '未入力' : formatYen(i.actualAmount) }}</template>
                        </td>
                        <td class="num muted">{{ diff(i.budgetAmount, i.actualAmount) }}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colspan="2">合計</td>
                        <td class="num">{{ formatYen(row.items.reduce((s, i) => s + i.budgetAmount, 0)) }}</td>
                        <td class="num">{{ formatYen(itemsActualTotal(row)) }}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                  <p v-if="can('executeEntries')" class="items-actions">
                    <button type="button" class="secondary" :disabled="!itemsChanged(row)" @click="onSaveItems(row)">執行額を保存</button>
                    <span v-if="itemsSaved" class="ok">保存しました（申請の金額も明細の合計にそろえました）</span>
                  </p>
                </div>
                <dl>
                  <template v-for="d in detailRows(row)" :key="d.label">
                    <dt>{{ d.label }}</dt>
                    <dd>
                      <template v-if="d.isUrl">
                        <template v-for="(u, n) in splitLinks(d.value)" :key="n">
                          <a v-if="isLink(u)" :href="u" target="_blank" rel="noopener">{{ u }}</a><span v-else>{{ u }}</span><br>
                        </template>
                      </template>
                      <template v-else>{{ d.value }}</template>
                    </dd>
                  </template>
                  <template v-if="row.remark"><dt>備考</dt><dd>{{ row.remark }}</dd></template>
                  <template v-if="row.attachmentId">
                    <dt>添付</dt>
                    <dd><a :href="`/api/entries/${row.id}/attachment`" target="_blank">ファイルを開く</a></dd>
                  </template>
                </dl>

                <div v-if="can('executeEntries')" class="exec">
                  <template v-if="row.status === 'pending'">
                    <label v-if="row.kind === 'execution' && row.type === '振込'">使用口座
                      <select v-model="exec.bank"><option v-for="b in TRANSFER_BANKS" :key="b">{{ b }}</option></select>
                    </label>
                    <template v-if="row.type === '発注' && !row.items.length">
                      <label>確定金額（円）<input v-model="exec.amount" type="number" min="1"></label>
                      <label>数量<input v-model="exec.quantity"></label>
                    </template>
                    <button @click="setDone(row, true)">対応済みにする</button>
                  </template>
                  <button v-else class="secondary" @click="setDone(row, false)">未対応に戻す</button>
                  <ul v-if="execErrors.length" class="error"><li v-for="e in execErrors" :key="e">{{ e }}</li></ul>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.page-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: 1rem; }
.page-head h1 { margin: 0; }
.items-table { width: auto; min-width: 32rem; margin: .4rem 0; background: var(--surface); }
.items-table th, .items-table td { padding: .25rem .5rem; }
.items-table input { width: 8rem; padding: .15rem .35rem; text-align: right; }
.items-table tfoot td { font-weight: 600; border-bottom: none; }
.items-actions { display: flex; align-items: center; gap: .75rem; margin: 0 0 .75rem; }
.ok { color: var(--done); font-size: .85rem; }
</style>
