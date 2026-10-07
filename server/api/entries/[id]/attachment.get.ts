import { eq } from 'drizzle-orm'

/** 添付ファイル（請求書・証憑）。会計担当か申請者本人のみ */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const entry = await db.query.entries.findFirst({ where: eq(schema.entries.id, id) })
  if (!entry?.attachmentId || (!user.isAdmin && entry.applicantEmail !== user.email)) {
    throw createError({ statusCode: 404 })
  }

  const file = await db.query.attachments.findFirst({ where: eq(schema.attachments.id, entry.attachmentId) })
  if (!file) throw createError({ statusCode: 404 })

  setResponseHeaders(event, {
    'Content-Type': file.contentType,
    'Content-Length': String(file.size),
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  return file.data
})
