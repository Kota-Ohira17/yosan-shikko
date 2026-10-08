<script setup lang="ts">
/** 執行依頼。Google フォーム「予算執行依頼フォーム」と同じ質問・選択肢・説明文にそろえている */
import {
  ACCOUNT_TYPES, BUDGET_CHANGES, DELIVERY_PLACES, METHOD_GROUPS, ONLINE_SITES, OTHER_METHODS, PAPER_RECEIPT,
} from '#shared/constants'

const { user } = useUserSession()
const { submit, errors, pending } = useSubmit<{ seq: string }>('/api/entries')

const form = reactive({
  applicantName: user.value?.name ?? '',
  department: '',
  inCharge: '',
  budgetLineKeys: [] as string[],
  itemAmounts: {} as Record<string, number | ''>,
  itemNumber: '',
  itemName: '',
  budgetChange: '',
  remark: '',
  amount: '',
  // 振込
  transferDeadline: '',
  bank: { bankName: '', branchName: '', accountType: '', accountNumber: '', accountName: '' },
  // 発注
  site: '',
  url: '',
  quantity: '',
  neededBy: '',
  deliveryPlace: '',
  // 立替
  purchase: '',
  paperReceipt: '',
  payPlanDate: '',
  // 現金執行・カード決済・その他
  otherChoice: '',
  executeAt: '',
  details: '',
})
const methodGroup = ref('')
const file = ref<File | null>(null)
const confirmed = ref(false)
const done = ref<string>()

useBureauFromItems(toRef(form, 'budgetLineKeys'), toRef(form, 'department'))
const onAmountInput = useTotalFromItems(toRef(form, 'itemAmounts'), toRef(form, 'amount'))
const onBudgetChangeInput = useBudgetChangeFromItems(toRef(form, 'budgetLineKeys'), toRef(form, 'itemAmounts'), toRef(form, 'budgetChange'))

/** 2段目の執行形態（現金執行 / カード決済 / その他） */
const otherType = computed(() => OTHER_METHODS.find(m => m.label === form.otherChoice)?.type ?? (form.otherChoice ? 'その他' : ''))
const OTHER_LABELS = OTHER_METHODS.filter(m => m.type !== 'その他').map(m => m.label)

/** 選んだ形態に関係する項目だけ送る */
function buildPayload() {
  const common = {
    applicantName: form.applicantName,
    department: form.department,
    inCharge: form.inCharge,
    budgetLineKeys: form.budgetLineKeys,
    itemAmounts: filledAmounts(form.itemAmounts),
    itemNumber: form.itemNumber,
    itemName: form.itemName,
    budgetChange: form.budgetChange,
    remark: form.remark,
  }
  switch (methodGroup.value) {
    case '振込': return { ...common, type: '振込', amount: form.amount, deadline: form.transferDeadline, bank: form.bank }
    case '発注': return { ...common, type: '発注', site: form.site, url: form.url, quantity: form.quantity, deadline: form.neededBy, deliveryPlace: form.deliveryPlace }
    case '立替': return { ...common, type: '立替', amount: form.amount, purchase: form.purchase, paperReceipt: form.paperReceipt, deadline: form.payPlanDate }
    default: return {
      ...common,
      type: otherType.value,
      otherMethod: otherType.value === 'その他' ? form.otherChoice : '',
      amount: form.amount,
      deadline: form.executeAt,
      details: form.details,
    }
  }
}

async function onSubmit() {
  const result = await submit(buildPayload(), methodGroup.value === '振込' ? file.value : null)
  if (result) done.value = result.seq
}
</script>

<template>
  <section class="card">
    <h1>予算執行依頼フォーム</h1>

    <div v-if="done" class="success">
      <p>受け付けました（受付番号 {{ done }}）。</p>
      <NuxtLink to="/entries">申請一覧へ</NuxtLink>
    </div>

    <form v-else @submit.prevent="onSubmit">
      <div class="intro">
        <p>ZAIに予算執行を依頼するフォームです。<br>予算執行には、主に以下の方法が存在します。</p>
        <ul>
          <li>振込</li>
          <li>発注（ASKUL、モノタロウ、Amazon、楽天、アースダンボールなど）</li>
          <li>立替</li>
          <li>現金執行</li>
          <li>引き落とし（クレジットカード登録）/その他</li>
        </ul>
        <p class="warn">不正防止のため回答後の編集はできません、注意してください。</p>
      </div>

      <fieldset>
        <legend>予算執行依頼フォーム</legend>
        <label><span>申請者氏名<span class="req">*</span></span><input v-model="form.applicantName" placeholder="例：こまばたろう" required></label>
        <div class="row">
          <BureauField v-model="form.department" />
          <label><span>担当名<span class="req">*</span></span><input v-model="form.inCharge" placeholder="例：zas" required></label>
        </div>

        <div class="block">
          <span class="block-label">項目番号・支出項目名<span class="req">*</span></span>
          <p class="hint">補正予算総会にて承認された補正予算から選んでください。款でまとめて申請する場合は、款の見出しのチェックボックスで款ごと選べます。</p>
          <ExpenseItemsField
            v-model:keys="form.budgetLineKeys"
            v-model:amounts="form.itemAmounts"
            v-model:item-number="form.itemNumber"
            v-model:item-name="form.itemName"
            item-name-label="支出項目名"
          />
          <p class="hint">支出項目名は、どの項目に対応するかが分かれば正式名称でなくても大丈夫です。</p>
        </div>

        <RadioWithOther
          v-model="form.budgetChange"
          label="補正予算からの変更"
          :options="BUDGET_CHANGES"
          required
          hint="増額の場合はフォームに回答したうえで、必ずZAIに相談してください。（入力した執行額と予算額の差から自動で選んでいます。違う場合は選び直してください）"
          @change="onBudgetChangeInput"
        />

        <RadioWithOther v-model="methodGroup" label="執行形態" :options="METHOD_GROUPS" required />
      </fieldset>

      <fieldset v-if="methodGroup === '振込'">
        <legend>振込</legend>
        <p class="section-desc">ZAIが取引先の口座に直接振り込みます。</p>
        <label>（ある場合は）請求書<input type="file" accept="application/pdf,image/*" @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"></label>
        <label><span>振込期限<span class="req">*</span></span><input v-model="form.transferDeadline" type="date" required></label>
        <label><span>振込金額<span class="req">*</span></span>
          <span class="hint">絶対に間違えないでください。「円」は入れないでください。</span>
          <input v-model="form.amount" type="number" min="1" placeholder="例：10000" required @input="onAmountInput">
        </label>
        <div class="row">
          <label><span>金融機関名<span class="req">*</span></span><input v-model="form.bank.bankName" placeholder="例：ゆうちょ銀行" required></label>
          <label><span>支店名・出張所名<span class="req">*</span></span><input v-model="form.bank.branchName" placeholder="例：渋谷支店" required></label>
        </div>
        <RadioWithOther v-model="form.bank.accountType" label="振込先の口座種別" :options="ACCOUNT_TYPES" other required />
        <div class="row">
          <label><span>振込先の口座番号<span class="req">*</span></span><input v-model="form.bank.accountNumber" inputmode="numeric" pattern="\d{1,8}" required></label>
          <label><span>振込先の口座名義<span class="req">*</span></span><input v-model="form.bank.accountName" required></label>
        </div>
        <p class="hint">口座情報は財務局長・管理者だけが閲覧でき、Slack通知には含まれません。</p>
        <label>備考<textarea v-model="form.remark" rows="3" /></label>
      </fieldset>

      <fieldset v-else-if="methodGroup === '発注'">
        <legend>発注</legend>
        <p class="section-desc">ZAIが駒場祭委員会の各種アカウントで発注を行います。</p>
        <RadioWithOther v-model="form.site" label="通販サイト" :options="ONLINE_SITES" other required />
        <label><span>商品ページのリンク<span class="req">*</span></span>
          <textarea v-model="form.url" rows="3" placeholder="複数ある場合は改行して入力してください" required />
        </label>
        <label><span>数量<span class="req">*</span></span><input v-model="form.quantity" required></label>
        <label><span>いつまでに必要ですか？<span class="req">*</span></span><input v-model="form.neededBy" type="date" required></label>
        <RadioWithOther v-model="form.deliveryPlace" label="配達場所" :options="DELIVERY_PLACES" other required />
        <label>備考<input v-model="form.remark"></label>
      </fieldset>

      <fieldset v-else-if="methodGroup === '立替'">
        <legend>立替</legend>
        <p class="section-desc">
          委員が一度私費で支払いを行い、後日ZAIが精算を行います。<br>
          領収書といった証憑は必ず<NuxtLink to="/evidences/new">証憑提出</NuxtLink>から提出してください。<br>
          清算の日程については購入後領収書等とともに証憑提出で希望を入力してください。
        </p>
        <label><span>立替合計金額<span class="req">*</span></span>
          <span class="hint">「円」は入れないでください。</span>
          <input v-model="form.amount" type="number" min="1" placeholder="例：10000" required @input="onAmountInput">
        </label>
        <label><span>購入先<span class="req">*</span></span><input v-model="form.purchase" required></label>
        <RadioWithOther
          v-model="form.paperReceipt"
          label="紙媒体の領収証の有無"
          :options="PAPER_RECEIPT"
          required
          hint="ある場合、購入後すぐに証憑提出から提出してください。また、清算の際に忘れずに持参してください。"
        />
        <label><span>立替予定日<span class="req">*</span></span><input v-model="form.payPlanDate" type="date" required></label>
        <label>備考<textarea v-model="form.remark" rows="3" /></label>
      </fieldset>

      <fieldset v-else-if="methodGroup">
        <legend>現金執行・カード決済（デビットカード）・その他</legend>
        <p class="section-desc">カード決済にはカードの登録も含みます。</p>
        <RadioWithOther v-model="form.otherChoice" label="執行形態" :options="OTHER_LABELS" other required />
        <label><span>金額<span class="req">*</span></span>
          <span class="hint">「円」は入れないでください。</span>
          <input v-model="form.amount" type="number" min="1" placeholder="例：10000" required @input="onAmountInput">
        </label>
        <label><span>執行希望日時<span class="req">*</span></span>
          <span class="hint">ZAIの都合が合わない場合はこちらから連絡します。</span>
          <input v-model="form.executeAt" type="datetime-local" required>
        </label>
        <label><span>詳細<span class="req">*</span></span>
          <span class="hint">以下に詳細に記入してください。こちらから後日連絡します。</span>
          <textarea v-model="form.details" rows="3" required />
        </label>
        <label>備考<textarea v-model="form.remark" rows="3" /></label>
      </fieldset>

      <template v-if="methodGroup">
        <div class="confirm">
          <span class="block-label">以上の内容に誤りがないことを確認しましたか？<span class="req">*</span></span>
          <p class="hint">送信後の編集はできません。</p>
          <label class="check"><input v-model="confirmed" type="checkbox"> はい</label>
        </div>
        <ul v-if="errors.length" class="error"><li v-for="e in errors" :key="e">{{ e }}</li></ul>
        <button type="submit" :disabled="!confirmed || pending">{{ pending ? '送信中…' : '送信' }}</button>
      </template>
    </form>
  </section>
</template>

<style scoped>
.intro { border-left: 4px solid var(--accent); padding: .25rem .9rem; font-size: .9rem; }
.intro p { margin: .3rem 0; }
.intro ul { margin: .2rem 0; padding-left: 1.4rem; }
.warn { color: var(--danger); font-weight: 600; }
.req { color: var(--danger); margin-left: .15rem; }
.section-desc { margin: 0; font-size: .9rem; color: var(--muted); }
.block { display: grid; gap: .4rem; }
.block-label { font-size: .9rem; }
.confirm { display: grid; gap: .25rem; }
label .hint { display: block; }
</style>
