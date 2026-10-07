<script setup lang="ts">
const { user } = useUserSession()
</script>

<template>
  <section class="tiles">
    <NuxtLink to="/requests/new" class="tile">
      <h2>執行依頼</h2>
      <p>振込・発注・立替・現金執行・カード決済の依頼</p>
    </NuxtLink>
    <NuxtLink to="/evidences/new" class="tile">
      <h2>証憑提出</h2>
      <p>立替後の領収書・レシートの提出</p>
    </NuxtLink>
    <NuxtLink to="/entries" class="tile">
      <h2>{{ user?.isAdmin ? '台帳' : '自分の申請' }}</h2>
      <p>{{ user?.isAdmin ? '番号順・申請順・形態別の一覧と対応済み処理' : '申請した内容と対応状況' }}</p>
    </NuxtLink>
  </section>
</template>
