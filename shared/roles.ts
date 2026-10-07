/**
 * 権限（役割）と、それぞれができること。サーバー・画面の両方でこの表だけを見て判定する。
 * 役割を足したり、できることを変えたりするときはここを直す。
 */
export const ROLES = ['member', 'bureau_head', 'accountant', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  member: '一般委員',
  bureau_head: '局長',
  accountant: '会計担当',
  admin: '管理者',
}

export const PERMISSIONS = {
  /** すべての申請を見る（台帳） */
  viewAllEntries: ['accountant', 'admin'],
  /** 自分の局（users.bureau と申請の「局」が一致）の申請を見る */
  viewBureauEntries: ['bureau_head', 'accountant', 'admin'],
  /** 振込先の口座情報を見る */
  viewBankAccount: ['accountant', 'admin'],
  /** 対応済みにする / 戻す */
  executeEntries: ['accountant', 'admin'],
  /** 予算 CSV の取り込み */
  importBudget: ['accountant', 'admin'],
  /** ユーザーの権限を変える */
  manageUsers: ['admin'],
} as const satisfies Record<string, readonly Role[]>
export type Permission = keyof typeof PERMISSIONS

export function can(role: Role | undefined | null, permission: Permission) {
  return role != null && (PERMISSIONS[permission] as readonly Role[]).includes(role)
}
