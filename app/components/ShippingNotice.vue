<script setup lang="ts">
/** 発注の送料についての案内（送料無料の基準・まとめて発注するべきか） */
import type { ShippingAdvice } from '#shared/shipping'

defineProps<{ advice: ShippingAdvice | null, site: string }>()
</script>

<template>
  <div v-if="advice" class="shipping" :class="{ ok: advice.free === true, warn: advice.free === false }" role="note">
    <strong>送料（{{ site }}）</strong>
    <ul>
      <li v-for="m in advice.messages" :key="m">{{ m }}</li>
    </ul>
    <p class="hint">{{ advice.note }}</p>
  </div>
</template>

<style scoped>
.shipping { padding: .6rem .8rem; border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 6px; background: var(--surface); font-size: .88rem; }
.shipping.ok { border-left-color: var(--done); }
.shipping.warn { border-left-color: #d9a400; background: #fffaeb; }
.shipping ul { margin: .25rem 0; padding-left: 1.2rem; }
</style>
