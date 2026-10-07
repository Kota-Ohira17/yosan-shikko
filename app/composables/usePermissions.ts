import { can as canRole, ROLE_LABELS, type Permission } from '#shared/roles'

/** ログイン中のユーザーの権限。表示の出し分け用（実際の制限はサーバー側で行う） */
export function usePermissions() {
  const { user } = useUserSession()
  const can = (permission: Permission) => canRole(user.value?.role, permission)
  const roleLabel = computed(() => (user.value ? ROLE_LABELS[user.value.role] : ''))
  /** 一覧ページの名前（権限によって見える範囲が違う） */
  const entriesTitle = computed(() => {
    if (can('viewAllEntries')) return '台帳'
    if (can('viewBureauEntries') && user.value?.bureau) return `${user.value.bureau}の申請`
    return '自分の申請'
  })
  return { user, can, roleLabel, entriesTitle }
}
