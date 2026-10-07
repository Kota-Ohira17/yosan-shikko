<script setup lang="ts">
const { loggedIn, clear, fetch: refreshSession } = useUserSession()
const { user, can, roleLabel, entriesTitle } = usePermissions()

// 管理者が権限を変えたときに、メニューの表示も追いつくようページ移動のたびに取り直す
const router = useRouter()
router.afterEach(() => {
  if (loggedIn.value) refreshSession().catch(() => {})
})

async function logout() {
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <div>
    <header class="header">
      <NuxtLink to="/" class="brand">予算執行</NuxtLink>
      <nav v-if="loggedIn" class="nav">
        <NuxtLink to="/requests/new">執行依頼</NuxtLink>
        <NuxtLink to="/evidences/new">証憑提出</NuxtLink>
        <NuxtLink to="/entries">{{ entriesTitle }}</NuxtLink>
        <NuxtLink v-if="can('importBudget')" to="/budget">予算</NuxtLink>
        <NuxtLink v-if="can('manageUsers')" to="/users">ユーザー</NuxtLink>
      </nav>
      <div v-if="loggedIn" class="me">
        <span>{{ user?.name }}<small>（{{ roleLabel }}）</small></span>
        <button class="link" @click="logout">ログアウト</button>
      </div>
    </header>
    <main class="main">
      <NuxtPage />
    </main>
  </div>
</template>
