<script setup lang="ts">
import { useMenu } from '~/composables/useMenu'

const { entriesTitle } = usePermissions()
const menu = useMenu()
const items = computed(() => menu.value.filter(m => m.home))
</script>

<template>
  <section>
    <h1 class="page-title">ホーム</h1>
    <div class="tiles">
      <NuxtLink v-for="m in items" :key="m.to" :to="m.to" class="tile">
        <AppIcon :name="m.icon" />
        <span>{{ m.to === '/entries' ? entriesTitle : m.label }}</span>
      </NuxtLink>
    </div>
  </section>
</template>
