import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { PAYMENT_TYPES } from '../../shared/constants'

/**
 * 執行依頼と証憑提出をまとめて1テーブルで持つ。
 * 旧GASでは「形態別シート・番号順・申請順」に同じ行をコピーしていたが、
 * ここでは1行だけ保存し、一覧はクエリ（ビュー）で切り替える。
 */
export const entries = sqliteTable('entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 表示用の通し番号（執行依頼: E-001 / 証憑: R-001） */
  seq: text('seq').notNull().unique(),
  kind: text('kind', { enum: ['execution', 'evidence'] }).notNull(),
  type: text('type', { enum: PAYMENT_TYPES }).notNull(),
  status: text('status', { enum: ['pending', 'done'] }).notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  applicantEmail: text('applicant_email').notNull(),
  applicantName: text('applicant_name').notNull(),
  department: text('department').notNull(),
  inCharge: text('in_charge').notNull(),
  itemNumber: text('item_number').notNull(),
  itemName: text('item_name').notNull(),
  amount: integer('amount'),
  quantity: text('quantity'),
  /** 振込期限・必要日・立替予定日・執行希望日・(証憑)立替日 */
  deadline: text('deadline'),
  remark: text('remark').notNull().default(''),
  /** 形態ごとの追加項目。口座情報は details.bank に入り、会計担当以外には返さない */
  details: text('details', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  attachmentPath: text('attachment_path'),
  /** 執行時に確定する執行形態（振込（SMBC）/ 口座引落 / 立替 など） */
  paymentMethod: text('payment_method'),
  executedAt: integer('executed_at', { mode: 'timestamp_ms' }),
  executedBy: text('executed_by'),
})

export const counters = sqliteTable('counters', {
  name: text('name').primaryKey(),
  value: integer('value').notNull(),
})

export type Entry = typeof entries.$inferSelect
