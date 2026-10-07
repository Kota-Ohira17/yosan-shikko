<script setup lang="ts">
/**
 * 局の入力欄。台帳で局ごとに見やすいよう、表記ゆれが出ないよう予算の局名から選ばせる。
 * 予算が未取り込みのときや一覧にない局は手入力。
 */
const bureau = defineModel<string>({ required: true })
const { data: lines } = await useBudgetLines()
const bureaus = computed(() => [...new Set(lines.value.map(l => l.bureau).filter(Boolean))])

const OTHER = '__other__'
const manual = ref(false)
const selectValue = computed({
  get: () => (manual.value || (bureau.value && !bureaus.value.includes(bureau.value)) ? OTHER : bureau.value),
  set: (v: string) => {
    manual.value = v === OTHER
    bureau.value = v === OTHER ? '' : v
  },
})
</script>

<template>
  <label v-if="!bureaus.length">局<input v-model="bureau" required></label>
  <div v-else class="bureau">
    <label>局
      <select v-model="selectValue" required>
        <option value="" disabled>選んでください</option>
        <option v-for="b in bureaus" :key="b" :value="b">{{ b }}</option>
        <option :value="OTHER">その他（手入力）</option>
      </select>
    </label>
    <label v-if="selectValue === OTHER">局名<input v-model="bureau" required></label>
  </div>
</template>

<style scoped>
.bureau { display: grid; gap: .5rem; }
</style>
