import type { Entry } from '../db/schema'

/** n8n の Webhook に通知する（Slack 転送用）。失敗しても申請自体は成功扱いにする */
export async function notifyN8n(event: 'created' | 'executed', entry: Entry) {
  const { n8nWebhookUrl, n8nWebhookSecret } = useRuntimeConfig()
  if (!n8nWebhookUrl) return
  try {
    await $fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: n8nWebhookSecret ? { 'X-Webhook-Secret': n8nWebhookSecret } : {},
      body: { event, entry: toNotification(entry) },
      timeout: 10_000,
    })
  }
  catch (error) {
    console.error('[notifyN8n] 通知に失敗しました', entry.seq, error)
  }
}
