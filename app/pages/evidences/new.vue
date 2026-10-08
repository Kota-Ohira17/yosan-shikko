<script setup lang="ts">
const { user } = useUserSession()
const { submit, errors, pending } = useSubmit<{ seq: string }>('/api/evidences')

const form = reactive({
  advancedName: user.value?.name ?? '',
  department: '',
  inCharge: '',
  budgetLineKeys: [] as string[],
  itemAmounts: {} as Record<string, number | ''>,
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
const onAmountInput = useTotalFromItems(toRef(form, 'itemAmounts'), toRef(form, 'amount'))
const done = ref<string>()

async function onSubmit() {
  const result = await submit({ ...form, itemAmounts: filledAmounts(form.itemAmounts) }, file.value)
  if (result) done.value = result.seq
}
</script>

<template>
  <section class="card">
    <h1>証憑提出</h1>

    <div v-if="done" class="success">
      <p>受け付けました（受付番号 {{ done }}）。</p>
      <NuxtLink to="/entries">申請一覧へ</NuxtLink>
    </div>

    <form v-else @submit.prevent="onSubmit">
      <label>提出者（立替者）氏名<input v-model="form.advancedName" required></label>
      <div class="row">
        <BureauField v-model="form.department" />
        <label>担当名<input v-model="form.inCharge" required></label>
      </div>
      <fieldset>
        <legend>支出項目（複数選択可）</legend>
        <ExpenseItemsField
          v-model:keys="form.budgetLineKeys"
          v-model:amounts="form.itemAmounts"
          v-model:item-number="form.itemNumber"
          v-model:item-name="form.itemName"
          item-name-label="支出項目名（内訳）"
        />
      </fieldset>
      <label>数量<input v-model="form.quantity" required></label>
      <div class="row">
        <label>証憑の種類
          <select v-model="form.kindOfEvidence">
            <option>領収書</option><option>レシート</option><option>見積書</option><option>その他</option>
          </select>
        </label>
        <label>立替日付<input v-model="form.payDate" type="date" required></label>
      </div>
      <label>立替金額（円）<input v-model="form.amount" type="number" min="1" required @input="onAmountInput"></label>
      <label>証憑ファイル<input type="file" accept="application/pdf,image/*" required @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"></label>
      <label>返金時期
        <select v-model="form.refundTiming"><option>委員返金と同時</option><option>できる限り早く</option></select>
      </label>

      <ul v-if="errors.length" class="error"><li v-for="e in errors" :key="e">{{ e }}</li></ul>
      <button type="submit" :disabled="pending">{{ pending ? '送信中…' : '送信' }}</button>
    </form>
  </section>
</template>
