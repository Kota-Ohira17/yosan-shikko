import { evidenceSchema } from '../../../shared/schemas'

/** 証憑提出（旧「証憑管理」フォーム）。立替の台帳登録もここで行う */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { payload, file } = await readPayloadAndFile(event)
  const input = parseOr400(evidenceSchema.safeParse(payload))
  if (!file) {
    throw createError({ statusCode: 400, message: '証憑ファイルを添付してください' })
  }

  const attachmentPath = await saveAttachment(
    file,
    input.itemNumber,
    `${input.inCharge}_${input.itemName}_${input.kindOfEvidence}`,
  )

  const [entry] = await useDb()
    .insert(schema.entries)
    .values({
      seq: await nextSeq('evidence'),
      kind: 'evidence',
      type: '立替',
      createdAt: new Date(),
      applicantEmail: user.email,
      applicantName: input.advancedName,
      department: input.department,
      inCharge: input.inCharge,
      itemNumber: input.itemNumber,
      itemName: input.itemName,
      amount: input.amount,
      quantity: input.quantity,
      deadline: input.payDate,
      details: { kindOfEvidence: input.kindOfEvidence, refundTiming: input.refundTiming },
      attachmentPath,
      // 旧GASでは証憑提出時点で執行形態「立替」・執行日=立替日として記録していた
      paymentMethod: '立替',
    })
    .returning()

  await notifyN8n('created', entry!)
  setResponseStatus(event, 201)
  return toPublicEntry(entry!, user.isAdmin)
})
