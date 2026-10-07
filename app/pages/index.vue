<script setup lang="ts">
const { can, entriesTitle } = usePermissions()

const entriesDescription = computed(() =>
  can('executeEntries') ? '番号順・申請順・形態別の一覧と対応済み処理' : '申請した内容と対応状況',
)
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
      <h2>{{ entriesTitle }}</h2>
      <p>{{ entriesDescription }}</p>
    </NuxtLink>
    <NuxtLink v-if="can('importBudget')" to="/budget" class="tile">
      <h2>予算</h2>
      <p>本予算スプレッドシートの取り込みと明細の確認</p>
    </NuxtLink>
    <NuxtLink v-if="can('manageUsers')" to="/users" class="tile">
      <h2>ユーザー</h2>
      <p>委員の登録と権限（一般・財務局長）の変更</p>
    </NuxtLink>
  </section>
</template>
