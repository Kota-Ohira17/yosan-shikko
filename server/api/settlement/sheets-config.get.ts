/** スプレッドシート出力の設定状況（共有してもらうサービスアカウントのメールアドレス） */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'exportSettlement')
  const sa = serviceAccount()
  return { configured: !!sa, serviceAccountEmail: sa?.email ?? '' }
})
