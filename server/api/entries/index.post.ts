import { executionRequestSchema } from '../../../shared/schemas'

/** 執行依頼（旧「執行依頼」フォーム） */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { payload, file } = await readPayloadAndFile(event)
  const input = parseOr400(executionRequestSchema.safeParse(payload))

  const {
    type, applicantName, department, inCharge, itemNumber, itemName, remark, deadline,
    ...rest
  } = input
  const { amount, quantity, ...details } = rest as typeof rest & { amount?: number, quantity?: string }

  const attachmentPath = file
    ? await saveAttachment(file, itemNumber, `${inCharge}_${itemName}_請求書`)
    : null

  const [entry] = await useDb()
    .insert(schema.entries)
    .values({
      seq: await nextSeq('execution'),
      kind: 'execution',
      type,
      createdAt: new Date(),
      applicantEmail: user.email,
      applicantName,
      department,
      inCharge,
      itemNumber,
      itemName,
      amount: amount ?? null,
      quantity: quantity ?? null,
      deadline,
      remark,
      details,
      attachmentPath,
    })
    .returning()

  await notifyN8n('created', entry!)
  setResponseStatus(event, 201)
  return toPublicEntry(entry!, user.isAdmin)
})
