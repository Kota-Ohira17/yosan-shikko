<script setup lang="ts">
import { TRANSFER_BANKS, VIEWS, type ViewKey } from '#shared/constants'

const { user } = useUserSession()
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
  url: '商品ページ',
  deliveryPlace: '配達場所',
  purchase: '購入先',
  paperReceipt: '紙の領収証',
  details: '詳細',
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
    .map(([k, v]) => ({ label: DETAIL_LABELS[k] ?? k, value: String(v), isUrl: k === 'url' }))
}

const yen = (n: number | null) => (n == null ? '' : `${n.toLocaleString('ja-JP')}円`)
const dateTime = (s: string | Date | null) => (s ? new Date(s).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' }) : '')

function toggle(row: Row) {
  opened.value = opened.value === row.id ? undefined : row.id
  exec.amount = row.amount ? String(row.amount) : ''
  exec.quantity = row.quantity ?? ''
  execErrors.value = []
}

async function setDone(row: Row, done: boolean) {
  execErrors.value = []
  try {
    await $fetch(`/api/entries/${row.id}/execute`, {
      method: 'POST',
      body: {
        done,
        bank: row.type === '振込' && row.kind === 'execution' ? exec.bank : undefined,
        amount: exec.amount ? Number(exec.amount) : undefined,
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
    <h1>{{ user?.isAdmin ? '台帳' : '自分の申請' }}</h1>

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
                <dl>
                  <template v-for="d in detailRows(row)" :key="d.label">
                    <dt>{{ d.label }}</dt>
                    <dd>
                      <a v-if="d.isUrl" :href="d.value" target="_blank" rel="noopener">{{ d.value }}</a>
                      <template v-else>{{ d.value }}</template>
                    </dd>
                  </template>
                  <template v-if="row.remark"><dt>備考</dt><dd>{{ row.remark }}</dd></template>
                  <template v-if="row.attachmentPath">
                    <dt>添付</dt>
                    <dd><a :href="`/api/entries/${row.id}/attachment`" target="_blank">ファイルを開く</a></dd>
                  </template>
                </dl>

                <div v-if="user?.isAdmin" class="exec">
                  <template v-if="row.status === 'pending'">
                    <label v-if="row.kind === 'execution' && row.type === '振込'">使用口座
                      <select v-model="exec.bank"><option v-for="b in TRANSFER_BANKS" :key="b">{{ b }}</option></select>
                    </label>
                    <template v-if="row.type === '発注'">
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
