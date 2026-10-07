import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { eq } from 'drizzle-orm'

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
  '.webp': 'image/webp',
}

/** 添付ファイル（請求書・証憑）。会計担当か申請者本人のみ */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  const entry = await useDb().query.entries.findFirst({ where: eq(schema.entries.id, id) })
  if (!entry?.attachmentPath || (!user.isAdmin && entry.applicantEmail !== user.email)) {
    throw createError({ statusCode: 404 })
  }

  const path = join(useRuntimeConfig().uploadDir, entry.attachmentPath)
  const { size } = await stat(path).catch(() => {
    throw createError({ statusCode: 404 })
  })
  setResponseHeaders(event, {
    'Content-Type': CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': String(size),
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(basename(path))}`,
  })
  return sendStream(event, createReadStream(path))
})
