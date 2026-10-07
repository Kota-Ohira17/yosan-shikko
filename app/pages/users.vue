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

async function remove(u: (typeof users.value)[number]) {
  if (!confirm(`${u.name}（${u.email}）を削除しますか？\n過去の申請は残ります。次にログインすると一般委員として登録し直されます。`)) return
  delete messages[u.email]
  try {
    await $fetch<unknown>(`/api/users/${encodeURIComponent(u.email)}`, { method: 'DELETE' })
    delete drafts[u.email]
    await refresh()
  }
  catch (error) {
    messages[u.email] = { ok: false, text: toMessages(error).join(' / ') }
  }
}

/** 委員の追加（まだログインしていない人にも先に権限を付けられる） */
const newUser = reactive({ email: '', name: '', role: 'member' as Role, bureau: '' })
const adding = ref(false)
const addErrors = ref<string[]>([])
const added = ref('')
async function add() {
  adding.value = true
  addErrors.value = []
  added.value = ''
  try {
    await $fetch<unknown>('/api/users', { method: 'POST', body: { ...newUser, bureau: newUser.role === 'bureau_head' ? newUser.bureau : '' } })
    added.value = `${newUser.email} を${ROLE_LABELS[newUser.role]}として登録しました`
    Object.assign(newUser, { email: '', name: '', role: 'member', bureau: '' })
    await refresh()
  }
  catch (error) {
    addErrors.value = toMessages(error)
  }
  finally {
    adding.value = false
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
const formatDate = (d: string | Date | null) => (d ? new Date(d).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' }) : '未ログイン')
</script>

<template>
  <section>
    <h1>ユーザーと権限</h1>
    <p class="hint">
      委員をメールアドレスで先に登録して権限を付けておけます。登録していない人も、初回ログインで「一般委員」として一覧に加わります。
      権限の変更は、その人の次の操作から反映されます。
    </p>

    <form class="card add" @submit.prevent="add">
      <h2>委員を追加</h2>
      <div class="add-fields">
        <label>メールアドレス<input v-model.trim="newUser.email" type="email" placeholder="xxxx@g.ecc.u-tokyo.ac.jp" required></label>
        <label>氏名（任意）<input v-model.trim="newUser.name" placeholder="初回ログイン時に更新されます"></label>
        <label>権限
          <select v-model="newUser.role">
            <option v-for="r in ROLES" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option>
          </select>
        </label>
        <label v-if="newUser.role === 'bureau_head'">担当局
          <select v-if="bureaus.length" v-model="newUser.bureau" required>
            <option value="" disabled>選んでください</option>
            <option v-for="b in bureaus" :key="b" :value="b">{{ b }}</option>
          </select>
          <input v-else v-model="newUser.bureau" placeholder="財務局" required>
        </label>
      </div>
      <ul v-if="addErrors.length" class="error"><li v-for="e in addErrors" :key="e">{{ e }}</li></ul>
      <p v-if="added" class="ok">{{ added }}</p>
      <button type="submit" :disabled="adding">{{ adding ? '追加中…' : '追加' }}</button>
    </form>

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
              <button
                v-if="u.email !== me?.email && !u.bootstrapAdmin"
                class="secondary"
                @click="remove(u)"
              >
                削除
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
.add { max-width: none; margin-bottom: 1.5rem; }
.add h2 { font-size: 1rem; margin: 0; }
.add-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .75rem; }
td button + button { margin-left: .5rem; }
</style>
