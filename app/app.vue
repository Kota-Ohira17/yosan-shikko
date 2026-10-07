<script setup lang="ts">
const { loggedIn, user, clear } = useUserSession()

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
        <NuxtLink to="/entries">{{ user?.isAdmin ? '台帳' : '自分の申請' }}</NuxtLink>
      </nav>
      <div v-if="loggedIn" class="me">
        <span>{{ user?.name }}<small v-if="user?.isAdmin">（会計）</small></span>
        <button class="link" @click="logout">ログアウト</button>
      </div>
    </header>
    <main class="main">
      <NuxtPage />
    </main>
  </div>
</template>
