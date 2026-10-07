<script setup lang="ts">
import { PERMISSIONS, ROLE_LABELS, ROLES, type Permission, type Role } from '#shared/roles'

const { can, user: me } = usePermissions()
if (!can('manageUsers')) await navigateTo('/')

const { data: users, refresh } = await useFetch('/api/users', { default: () => [] })
const { data: lines } = await useBudgetLines()
const bureaus = computed(() => [...new Set(lines.value.map(l => l.bureau).filter(Boolean))])

/** 行ごとの編集中の値 */
const drafts = reactive<Record<string, { role: Role, bureau: string }>>({})
watchEffect(() => {
  for (const u of users.value) drafts[u.email] ??= { role: u.role, bureau: u.bureau }
})
const saving = ref<string>()
const messages = reactive<Record<string, { ok: boolean, text: string }>>({})

const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return users.value.filter(u => !q || `${u.email} ${u.name} ${ROLE_LABELS[u.role]} ${u.bureau}`.toLowerCase().includes(q))
})

const changed = (u: (typeof users.value)[number]) =>
  drafts[u.email] && (drafts[u.email]!.role !== u.role || drafts[u.email]!.bureau !== u.bureau)

async function save(email: string) {
  const d = drafts[email]!
  saving.value = email
  delete messages[email]
  try {
    await $fetch<unknown>(`/api/users/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      body: { role: d.role, bureau: d.role === 'bureau_head' ? d.bureau : '' },
    })
    await refresh()
    drafts[email] = { role: d.role, bureau: d.role === 'bureau_head' ? d.bureau : '' }
    messages[email] = { ok: true, text: '保存しました' }
  }
  catch (error) {
    messages[email] = { ok: false, text: toMessages(error).join(' / ') }
  }
  finally {
    saving.value = undefined
  }
}

const PERMISSION_LABELS: Record<Permission, string> = {
  viewAllEntries: '全申請の閲覧（台帳）',
  viewBureauEntries: '担当局の申請の閲覧',
  viewBankAccount: '口座情報の閲覧',
  executeEntries: '対応済み操作',
  importBudget: '予算の取り込み',
  manageUsers: 'ユーザーの権限変更',
}
const formatDate = (d: string | Date) => new Date(d).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })
</script>

<template>
  <section>
    <h1>ユーザーと権限</h1>
    <p class="hint">ログインしたことのある人が一覧に出ます（初回は「一般委員」）。権限の変更は、その人の次の操作から反映されます。</p>

    <details class="card perms">
      <summary>権限ごとにできること</summary>
      <table>
        <thead>
          <tr><th />
            <th v-for="r in ROLES" :key="r">{{ ROLE_LABELS[r] }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(label, p) in PERMISSION_LABELS" :key="p">
            <th>{{ label }}</th>
            <td v-for="r in ROLES" :key="r" class="mark">{{ (PERMISSIONS[p] as readonly Role[]).includes(r) ? '○' : '' }}</td>
          </tr>
          <tr>
            <th>申請・自分の申請の閲覧</th>
            <td v-for="r in ROLES" :key="r" class="mark">○</td>
          </tr>
        </tbody>
      </table>
    </details>

    <input v-model="query" type="search" class="search" placeholder="絞り込み（メール・氏名・権限・局）">

    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>氏名</th><th>メール</th><th>権限</th><th>担当局（局長のみ）</th><th>最終ログイン</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="u in filtered" :key="u.email">
            <td>{{ u.name }}<small v-if="u.email === me?.email">（自分）</small></td>
            <td>{{ u.email }}</td>
            <td>
              <select v-if="drafts[u.email]" v-model="drafts[u.email]!.role" :disabled="u.bootstrapAdmin">
                <option v-for="r in ROLES" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option>
              </select>
              <small v-if="u.bootstrapAdmin" class="hint">環境変数で管理者に固定</small>
            </td>
            <td>
              <template v-if="drafts[u.email]?.role === 'bureau_head'">
                <select v-if="bureaus.length" v-model="drafts[u.email]!.bureau">
                  <option value="" disabled>選んでください</option>
                  <option v-for="b in bureaus" :key="b" :value="b">{{ b }}</option>
                </select>
                <input v-else v-model="drafts[u.email]!.bureau" placeholder="財務局">
              </template>
            </td>
            <td class="nowrap">{{ formatDate(u.lastLoginAt) }}</td>
            <td class="nowrap">
              <button v-if="changed(u)" :disabled="saving === u.email" @click="save(u.email)">
                {{ saving === u.email ? '保存中…' : '保存' }}
              </button>
              <span v-if="messages[u.email]" :class="messages[u.email]!.ok ? 'ok' : 'error'">{{ messages[u.email]!.text }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.perms { max-width: 720px; margin: 1rem 0; padding: .75rem 1rem; }
.perms summary { cursor: pointer; font-weight: 600; }
.perms table { margin-top: .5rem; }
.perms .mark { text-align: center; color: var(--done); font-weight: 700; }
.search { max-width: 420px; margin-bottom: .75rem; }
.nowrap { white-space: nowrap; }
td select, td input { min-width: 9rem; }
.ok { color: var(--done); margin-left: .5rem; }
.error { margin-left: .5rem; }
</style>
