<script setup lang="ts">
const route = useRoute()
const { public: { devLogin } } = useRuntimeConfig()
const { fetch: refreshSession } = useUserSession()

const dev = reactive({ email: '', name: '' })
const devErrors = ref<string[]>([])
const pending = ref(false)

async function loginDev() {
  devErrors.value = []
  pending.value = true
  try {
    await $fetch('/auth/dev', { method: 'POST', body: dev })
    await refreshSession()
    await navigateTo('/')
  }
  catch (error) {
    devErrors.value = toMessages(error)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="card narrow">
    <h1>ログイン</h1>
    <p>ECCアカウント（g.ecc.u-tokyo.ac.jp）でログインしてください。</p>
    <p v-if="route.query.error" class="error">
      Google ログインに失敗しました。<template v-if="devLogin">ローカルでは Google ログインは未設定なので、下の「開発用ログイン」を使ってください。</template>
    </p>
    <a href="/auth/google" class="button">Google でログイン</a>

    <form v-if="devLogin" class="dev" @submit.prevent="loginDev">
      <h2>開発用ログイン</h2>
      <p class="hint">パスワードは不要です。初回は「一般」で登録されます（NUXT_ADMIN_EMAILS に含まれるメールは財務局長）。</p>
      <label>メール<input v-model.trim="dev.email" type="email" placeholder="kaikei@g.ecc.u-tokyo.ac.jp" required></label>
      <label>氏名<input v-model.trim="dev.name" placeholder="会計テスト" required></label>
      <ul v-if="devErrors.length" class="error"><li v-for="e in devErrors" :key="e">{{ e }}</li></ul>
      <button type="submit" :disabled="pending">{{ pending ? 'ログイン中…' : 'ログイン' }}</button>
    </form>
  </section>
</template>
