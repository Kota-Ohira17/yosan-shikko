<script setup lang="ts">
const { user } = useUserSession()
const { submit, errors, pending } = useSubmit<{ seq: string }>('/api/evidences')

const form = reactive({
  advancedName: user.value?.name ?? '',
  department: '',
  inCharge: '',
  budgetLineKeys: [] as string[],
  itemAmounts: {} as Record<string, number | ''>,
  itemQuantities: {} as Record<string, string>,
  itemVendors: {} as Record<string, string>,
  itemNumber: '',
  itemName: '',
  quantity: '',
  kindOfEvidence: '領収書',
  payDate: '',
  amount: '',
  refundTiming: '委員返金と同時',
})
const file = ref<File | null>(null)
useBureauFromItems(toRef(form, 'budgetLineKeys'), toRef(form, 'department'))
/** 予算の表で開く局。自分で局を選んだときだけ変える（明細から局が自動で入ったときは表を動かさない） */
const tabBureau = ref('')
const onAmountInput = useTotalFromItems(toRef(form, 'itemAmounts'), toRef(form, 'amount'))
// 表から推測できる担当名は、選んだ明細から初期値を入れておく
useAutoFill(toRef(form, 'inCharge'), useTeamOfItems(toRef(form, 'budgetLineKeys')))
// 明細を選んだら、金額・数量は明細ごとの欄で入力し、その合計・まとめを申請の値にする（2回入力させない）
const hasItems = computed(() => form.budgetLineKeys.length > 0)
const itemsQuantity = useQuantityOfItems(toRef(form, 'budgetLineKeys'), toRef(form, 'itemQuantities'))
watch([itemsQuantity, hasItems], () => { if (hasItems.value) form.quantity = itemsQuantity.value })
watch([() => form.itemAmounts, hasItems], () => {
  if (!hasItems.value) return
  const values = form.budgetLineKeys.map(k => form.itemAmounts[k]).filter(v => typeof v === 'number') as number[]
  form.amount = values.length ? String(values.reduce((s, v) => s + v, 0)) : ''
}, { deep: true })
const done = ref<string>()

async function onSubmit() {
  const result = await submit({ ...form, itemAmounts: filledAmounts(form.itemAmounts) }, file.value)
  if (result) done.value = result.seq
}
</script>

<template>
  <section class="page">
    <h1>証憑提出</h1>

    <div v-if="done" class="success">
      <p>受け付けました（受付番号 {{ done }}）。</p>
      <NuxtLink to="/entries">申請一覧へ</NuxtLink>
    </div>

    <form v-else @submit.prevent="onSubmit">
      <label>提出者（立替者）氏名<input v-model="form.advancedName" required></label>
      <div class="row">
        <BureauField v-model="form.department" @update:model-value="tabBureau = $event" />
        <label>担当名<input v-model="form.inCharge" required></label>
      </div>
      <fieldset>
        <legend>支出項目（複数選択可）</legend>
        <ExpenseItemsField
          v-model:keys="form.budgetLineKeys"
          v-model:amounts="form.itemAmounts"
          v-model:quantities="form.itemQuantities"
          v-model:vendors="form.itemVendors"
          v-model:item-number="form.itemNumber"
          v-model:item-name="form.itemName"
          :preferred-bureau="tabBureau"
          item-name-label="支出項目名（内訳）"
        />
      </fieldset>
      <fieldset v-if="hasItems">
        <legend>明細ごとの立替金額・数量・取引先</legend>
        <ItemDetailsInputs
          v-model:amounts="form.itemAmounts"
          v-model:quantities="form.itemQuantities"
          v-model:vendors="form.itemVendors"
          :keys="form.budgetLineKeys"
          :fields="['quantity', 'vendor', 'amount']"
          amount-label="立替金額"
        />
      </fieldset>
      <label v-else>数量<input v-model="form.quantity" required></label>
      <div class="row">
        <label>証憑の種類
          <select v-model="form.kindOfEvidence">
            <option>領収書</option><option>レシート</option><option>見積書</option><option>その他</option>
          </select>
        </label>
        <label>立替日付<input v-model="form.payDate" type="date" required></label>
      </div>
      <label v-if="!hasItems">立替金額（円）<YenInput v-model="form.amount" required @input="onAmountInput" /></label>
      <label>証憑ファイル<input type="file" accept="application/pdf,image/*" required @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"></label>
      <label>返金時期
        <select v-model="form.refundTiming"><option>委員返金と同時</option><option>できる限り早く</option></select>
      </label>

      <ul v-if="errors.length" class="error"><li v-for="e in errors" :key="e">{{ e }}</li></ul>
      <button type="submit" :disabled="pending">{{ pending ? '送信中…' : '送信' }}</button>
    </form>
  </section>
</template>
