<script setup lang="ts">
/** 局の選択欄（Google フォームと同じ略称 JIM / ZAI / … から選ぶ） */
import { BUREAUS } from '#shared/constants'

const bureau = defineModel<string>({ required: true })
</script>

<template>
  <label><span>局<span class="req">*</span></span>
    <select v-model="bureau" required>
      <option value="" disabled>選択</option>
      <option v-for="b in BUREAUS" :key="b.code" :value="b.code">{{ b.code }}（{{ b.name }}）</option>
    </select>
  </label>
</template>

<style scoped>
.req { color: var(--danger); margin-left: .15rem; }
</style>
