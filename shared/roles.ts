/**
 * 権限（役割）と、それぞれができること。サーバー・画面の両方でこの表だけを見て判定する。
 * 財務局長と管理者はできることが同じで、名前（肩書き）だけが違う。それ以外は一般。
 * 役割を足したり、できることを変えたりするときはここを直す。
 */
export const ROLES = ['member', 'finance_chief', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  member: '一般',
  finance_chief: '財務局長',
  admin: '管理者',
}

/** 特別な権限を持つ役割（財務局長・管理者） */
const STAFF = ['finance_chief', 'admin'] as const

export const PERMISSIONS = {
  /** すべての申請を見る（台帳） */
  viewAllEntries: STAFF,
  /** 振込先の口座情報を見る */
  viewBankAccount: STAFF,
  /** 対応済みにする / 戻す */
  executeEntries: STAFF,
  /** 予算 CSV の取り込み */
  importBudget: STAFF,
  /** 委員の登録・権限変更 */
  manageUsers: STAFF,
} as const satisfies Record<string, readonly Role[]>
export type Permission = keyof typeof PERMISSIONS

export function can(role: Role | undefined | null, permission: Permission) {
  return role != null && (PERMISSIONS[permission] as readonly Role[]).includes(role)
}
