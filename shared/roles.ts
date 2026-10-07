/**
 * 権限（役割）と、それぞれができること。サーバー・画面の両方でこの表だけを見て判定する。
 * 財務局長だけが台帳・口座情報・対応済み操作・予算取り込み・ユーザー管理を使え、それ以外は一般。
 * 役割を足したり、できることを変えたりするときはここを直す。
 */
export const ROLES = ['member', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  member: '一般',
  admin: '財務局長',
}

export const PERMISSIONS = {
  /** すべての申請を見る（台帳） */
  viewAllEntries: ['admin'],
  /** 振込先の口座情報を見る */
  viewBankAccount: ['admin'],
  /** 対応済みにする / 戻す */
  executeEntries: ['admin'],
  /** 予算 CSV の取り込み */
  importBudget: ['admin'],
  /** ユーザーの権限を変える */
  manageUsers: ['admin'],
} as const satisfies Record<string, readonly Role[]>
export type Permission = keyof typeof PERMISSIONS

export function can(role: Role | undefined | null, permission: Permission) {
  return role != null && (PERMISSIONS[permission] as readonly Role[]).includes(role)
}
