<script setup lang="ts">
import { PAYMENT_TYPES } from '#shared/constants'

const { user } = useUserSession()
const { submit, errors, pending } = useSubmit<{ seq: string }>('/api/entries')

const form = reactive({
  type: '振込' as (typeof PAYMENT_TYPES)[number],
  applicantName: user.value?.name ?? '',
  department: '',
  inCharge: '',
  budgetLineKeys: [] as string[],
  itemNumber: '',
  itemName: '',
  budgetChange: '変動なし',
  remark: '',
  deadline: '',
  amount: '',
  // 振込
  bank: { bankName: '', branchName: '', accountType: '普通', accountNumber: '', accountName: '' },
  // 発注
  site: '',
  url: '',
  quantity: '',
  deliveryPlace: '',
  // 立替
  purchase: '',
  paperReceipt: 'あり',
  // 現金執行・カード決済・その他
  details: '',
})
const file = ref<File | null>(null)
useBureauFromItems(toRef(form, 'budgetLineKeys'), toRef(form, 'department'))
const confirmed = ref(false)
const done = ref<string>()

const deadlineLabel = computed(() => ({
  振込: '振込期限',
  発注: 'いつまでに必要ですか',
  立替: '立替予定日',
}[form.type as string] ?? '執行希望日'))

/** 選んだ形態に関係する項目だけ送る */
function buildPayload() {
  const common = {
    type: form.type,
    applicantName: form.applicantName,
    department: form.department,
    inCharge: form.inCharge,
    budgetLineKeys: form.budgetLineKeys,
    itemNumber: form.itemNumber,
    itemName: form.itemName,
    budgetChange: form.budgetChange,
    remark: form.remark,
    deadline: form.deadline,
  }
  switch (form.type) {
    case '振込': return { ...common, amount: form.amount, bank: form.bank }
    case '発注': return { ...common, site: form.site, url: form.url, quantity: form.quantity, deliveryPlace: form.deliveryPlace }
    case '立替': return { ...common, amount: form.amount, purchase: form.purchase, paperReceipt: form.paperReceipt }
    default: return { ...common, amount: form.amount, details: form.details }
  }
}

async function onSubmit() {
  const result = await submit(buildPayload(), form.type === '振込' ? file.value : null)
  if (result) done.value = result.seq
}
</script>

<template>
  <section class="card">
    <h1>執行依頼</h1>

    <div v-if="done" class="success">
      <p>受け付けました（受付番号 {{ done }}）。</p>
      <NuxtLink to="/entries">申請一覧へ</NuxtLink>
    </div>

    <form v-else @submit.prevent="onSubmit">
      <fieldset>
        <legend>共通</legend>
        <label>申請者氏名<input v-model="form.applicantName" required></label>
        <div class="row">
          <BureauField v-model="form.department" />
          <label>担当名<input v-model="form.inCharge" placeholder="logi" required></label>
        </div>
        <label>補正予算からの変更
          <select v-model="form.budgetChange">
            <option>変動なし</option><option>増額</option><option>減額</option>
          </select>
        </label>
        <label>執行形態
          <select v-model="form.type">
            <option v-for="t in PAYMENT_TYPES" :key="t">{{ t }}</option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>執行項目（複数選択可）</legend>
        <ExpenseItemsField
          v-model:keys="form.budgetLineKeys"
          v-model:item-number="form.itemNumber"
          v-model:item-name="form.itemName"
          item-name-label="支出項目名"
        />
      </fieldset>

      <fieldset>
        <legend>{{ form.type }}</legend>

        <template v-if="form.type === '振込'">
          <label>請求書（ある場合）<input type="file" accept="application/pdf,image/*" @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"></label>
          <label>振込金額（円）<input v-model="form.amount" type="number" min="1" required></label>
          <div class="row">
            <label>金融機関名<input v-model="form.bank.bankName" required></label>
            <label>支店名・出張所名<input v-model="form.bank.branchName" required></label>
          </div>
          <div class="row">
            <label>口座種別
              <select v-model="form.bank.accountType"><option>普通</option><option>当座</option></select>
            </label>
            <label>口座番号<input v-model="form.bank.accountNumber" inputmode="numeric" pattern="\d{1,8}" required></label>
          </div>
          <label>口座名義<input v-model="form.bank.accountName" required></label>
          <p class="hint">口座情報は会計担当だけが閲覧でき、Slack通知には含まれません。</p>
        </template>

        <template v-else-if="form.type === '発注'">
          <label>通販サイト<input v-model="form.site" placeholder="Amazon" required></label>
          <label>商品ページのリンク<input v-model="form.url" type="url" required></label>
          <div class="row">
            <label>数量<input v-model="form.quantity" required></label>
            <label>配達場所<input v-model="form.deliveryPlace" required></label>
          </div>
        </template>

        <template v-else-if="form.type === '立替'">
          <label>立替合計金額（円）<input v-model="form.amount" type="number" min="1" required></label>
          <label>購入先<input v-model="form.purchase" required></label>
          <label>紙の領収証
            <select v-model="form.paperReceipt"><option>あり</option><option>なし</option></select>
          </label>
          <p class="hint">立替後に「証憑提出」から領収書を提出してください。</p>
        </template>

        <template v-else>
          <label>金額（円）<input v-model="form.amount" type="number" min="1" required></label>
          <label>詳細<textarea v-model="form.details" rows="3" required /></label>
        </template>

        <label>{{ deadlineLabel }}<input v-model="form.deadline" type="date" required></label>
        <label>備考<textarea v-model="form.remark" rows="3" /></label>
      </fieldset>

      <label class="check"><input v-model="confirmed" type="checkbox"> 以上の内容に誤りがないことを確認しました</label>
      <ul v-if="errors.length" class="error"><li v-for="e in errors" :key="e">{{ e }}</li></ul>
      <button type="submit" :disabled="!confirmed || pending">{{ pending ? '送信中…' : '送信' }}</button>
    </form>
  </section>
</template>
