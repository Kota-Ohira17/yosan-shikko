export const PAYMENT_TYPES = ['振込', '発注', '立替', '現金執行', 'カード決済', 'その他'] as const
export type PaymentType = (typeof PAYMENT_TYPES)[number]

export const TRANSFER_BANKS = ['SMBC', 'ゆうちょ'] as const

/** Vercel の関数は 4.5MB までしか受け取れないので、それより少し小さくする */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024

/** 一覧画面のビュー。旧スプレッドシートのシートに対応する */
export const VIEWS = {
  number: '番号順',
  time: '申請順',
  振込: '振込',
  発注: '発注',
  立替: '立替',
  現金執行: '現金執行',
  カード決済: 'カード決済',
  その他: 'その他',
  pending: '未対応',
} as const
export type ViewKey = keyof typeof VIEWS
