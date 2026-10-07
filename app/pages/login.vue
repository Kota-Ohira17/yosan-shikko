<script setup lang="ts">
const route = useRoute()
const { public: { devLogin } } = useRuntimeConfig()
const { fetch: refreshSession } = useUserSession()

const dev = reactive({ email: '', name: '' })
async function loginDev() {
  await $fetch('/auth/dev', { method: 'POST', body: dev })
  await refreshSession()
  await navigateTo('/')
}
</script>

<template>
  <section class="card narrow">
    <h1>ログイン</h1>
    <p>ECCアカウント（g.ecc.u-tokyo.ac.jp）でログインしてください。</p>
    <p v-if="route.query.error" class="error">ログインに失敗しました。</p>
    <a href="/auth/google" class="button">Google でログイン</a>

    <form v-if="devLogin" class="dev" @submit.prevent="loginDev">
      <h2>開発用ログイン</h2>
      <label>メール<input v-model="dev.email" type="email" required></label>
      <label>氏名<input v-model="dev.name" required></label>
      <button type="submit">ログイン</button>
    </form>
  </section>
</template>
