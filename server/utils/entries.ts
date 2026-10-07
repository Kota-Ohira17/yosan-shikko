import { sql } from 'drizzle-orm'
import type { Entry } from '../db/schema'

/** 通し番号を原子的に払い出す（旧GASの ScriptProperties カウンタの置き換え） */
export async function nextSeq(kind: 'execution' | 'evidence') {
  const [row] = await useDb()
    .insert(schema.counters)
    .values({ name: kind, value: 1 })
    .onConflictDoUpdate({ target: schema.counters.name, set: { value: sql`${schema.counters.value} + 1` } })
    .returning({ value: schema.counters.value })
  const prefix = kind === 'execution' ? 'E' : 'R'
  return `${prefix}-${String(row!.value).padStart(3, '0')}`
}

function withoutBank(details: Record<string, unknown>) {
  const { bank: _bank, ...rest } = details
  return rest
}

/** 会計担当以外には口座情報を返さない */
export function toPublicEntry(entry: Entry, isAdmin: boolean) {
  return isAdmin ? entry : { ...entry, details: withoutBank(entry.details) }
}

/** n8n/Slack に渡す内容。口座情報は常に除外する */
export function toNotification(entry: Entry) {
  const { applicantEmail: _email, attachmentPath, executedBy: _by, ...rest } = entry
  return { ...rest, details: withoutBank(entry.details), hasAttachment: Boolean(attachmentPath) }
}
