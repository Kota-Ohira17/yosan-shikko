import { z } from 'zod'
import { TRANSFER_BANKS } from './constants'

const required = (label: string) => {
  const message = `${label}を入力してください`
  return z.string({ error: message }).trim().min(1, message)
}
const date = z.string({ error: '日付を入力してください' }).regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください')
const yen = z.coerce.number({ error: '金額を数字で入力してください' }).int('整数で入力してください').positive('金額を入力してください')

export const ITEM_NUMBER_PATTERN = /^out-\d{2}(-\d{2}){1,2}$/

/**
 * 執行項目。予算明細から選ぶ（budgetLineKeys、複数可）か、予算にない場合は項目番号を手入力する。
 * どちらか一方が必要（checkItems で検証）。
 */
const items = {
  budgetLineKeys: z.array(z.string()).max(200, '選べる明細は200件までです').default([]),
  /** 明細ごとの実際の執行額（明細の key → 円）。予算額と違うことが多い */
  itemAmounts: z.record(z.string(), z.coerce.number({ error: '執行額は数字で入力してください' }).int('執行額は整数で入力してください')).default({}),
  itemNumber: z.string().trim().default(''),
}

/** 台帳で明細ごとの執行額を直す（entry_items の id → 円。null で未入力に戻す） */
export const itemAmountsUpdateSchema = z.object({
  amounts: z.record(z.string(), z.number().int('執行額は整数で入力してください').nullable()),
})

function checkItems(v: { budgetLineKeys: string[], itemNumber: string }, ctx: z.RefinementCtx) {
  if (v.budgetLineKeys.length) return
  if (!v.itemNumber) ctx.addIssue({ code: 'custom', message: '執行項目を予算から選んでください', path: ['budgetLineKeys'] })
  else if (!ITEM_NUMBER_PATTERN.test(v.itemNumber)) ctx.addIssue({ code: 'custom', message: '項目番号は out-03-02-06 の形式で入力してください', path: ['itemNumber'] })
}

const base = z.object({
  applicantName: required('申請者氏名'),
  department: required('局'),
  inCharge: required('担当名'),
  ...items,
  itemName: required('支出項目名'),
  budgetChange: z.enum(['変動なし', '増額', '減額'], { error: '補正予算からの変更を選んでください' }),
  remark: z.string().trim().default(''),
})

export const bankAccountSchema = z.object({
  bankName: required('金融機関名'),
  branchName: required('支店名'),
  accountType: z.enum(['普通', '当座']),
  accountNumber: z.string().regex(/^\d{1,8}$/, '口座番号は数字で入力してください'),
  accountName: required('口座名義'),
}, { error: '振込先の口座情報を入力してください' })

export const executionRequestSchema = z.discriminatedUnion('type', [
  base.extend({
    type: z.literal('振込'),
    deadline: date,
    amount: yen,
    bank: bankAccountSchema,
  }),
  base.extend({
    type: z.literal('発注'),
    site: required('通販サイト'),
    url: z.url('商品ページのURLを入力してください'),
    quantity: required('数量'),
    deadline: date,
    deliveryPlace: required('配達場所'),
  }),
  base.extend({
    type: z.literal('立替'),
    amount: yen,
    purchase: required('購入先'),
    paperReceipt: z.enum(['あり', 'なし']),
    deadline: date, // 立替予定日
  }),
  base.extend({
    type: z.enum(['現金執行', 'カード決済', 'その他']),
    amount: yen,
    deadline: date, // 執行希望日
    details: required('詳細'),
  }),
]).superRefine(checkItems)
export type ExecutionRequestInput = z.input<typeof executionRequestSchema>

export const evidenceSchema = z.object({
  advancedName: required('立替者氏名'),
  department: required('局'),
  inCharge: required('担当名'),
  ...items,
  itemName: required('支出項目名（内訳）'),
  quantity: required('数量'),
  kindOfEvidence: z.enum(['領収書', 'レシート', '見積書', 'その他']),
  payDate: date,
  amount: yen,
  refundTiming: z.enum(['委員返金と同時', 'できる限り早く']),
}).superRefine(checkItems)
export type EvidenceInput = z.input<typeof evidenceSchema>

export const executeSchema = z.object({
  done: z.boolean(),
  /** 振込のときに使った口座 */
  bank: z.enum(TRANSFER_BANKS).optional(),
  /** 発注のとき確定した金額・数量 */
  amount: yen.optional(),
  quantity: z.string().trim().optional(),
})
