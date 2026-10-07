import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { H3Event } from 'h3'

const MAX_BYTES = 20 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']

type Part = NonNullable<Awaited<ReturnType<typeof readMultipartFormData>>>[number]

/** multipart の `payload`（JSON）と `attachment`（ファイル）を取り出す */
export async function readPayloadAndFile(event: H3Event) {
  const parts = (await readMultipartFormData(event)) ?? []
  const payloadPart = parts.find(p => p.name === 'payload')
  if (!payloadPart) throw createError({ statusCode: 400, message: 'payload がありません' })
  let payload: unknown
  try {
    payload = JSON.parse(payloadPart.data.toString('utf8'))
  }
  catch {
    throw createError({ statusCode: 400, message: 'payload が JSON ではありません' })
  }
  const file = parts.find(p => p.name === 'attachment' && p.filename && p.data.length > 0)
  if (file) {
    if (file.data.length > MAX_BYTES) {
      throw createError({ statusCode: 400, message: 'ファイルは20MB以下にしてください' })
    }
    if (!file.type || !ALLOWED_TYPES.includes(file.type)) {
      throw createError({ statusCode: 400, message: 'PDF または画像ファイルを添付してください' })
    }
  }
  return { payload, file }
}

/**
 * 項目番号ごとのフォルダに保存する。
 * 旧GASの folderTable（Drive フォルダIDのハードコード）の置き換えで、フォルダは自動で作られる。
 */
export async function saveAttachment(file: Part, itemNumber: string, label: string) {
  const { uploadDir } = useRuntimeConfig()
  const folder = itemNumber.slice(0, 9) // out-03-02 単位（旧GASと同じ）
  const safeLabel = label.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80)
  const fileName = `${Date.now()}_${safeLabel}${extname(file.filename ?? '').toLowerCase()}`
  await mkdir(join(uploadDir, folder), { recursive: true })
  await writeFile(join(uploadDir, folder, fileName), file.data)
  return `${folder}/${fileName}`
}

/** zod のエラーを 400 にする */
export function parseOr400<T>(result: { success: true, data: T } | { success: false, error: { issues: { message: string }[] } }) {
  if (!result.success) {
    throw createError({ statusCode: 400, message: '入力内容に誤りがあります', data: result.error.issues.map(i => i.message) })
  }
  return result.data
}
