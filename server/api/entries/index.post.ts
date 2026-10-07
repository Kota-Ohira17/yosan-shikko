import { executionRequestSchema } from '../../../shared/schemas'

/** 執行依頼（旧「執行依頼」フォーム） */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { payload, file } = await readPayloadAndFile(event)
  const input = parseOr400(executionRequestSchema.safeParse(payload))

  const {
    type, applicantName, department, inCharge, budgetLineKeys, itemNumber: manualItemNumber, itemName, remark, deadline,
    ...rest
  } = input
  const { amount, quantity, ...details } = rest as typeof rest & { amount?: number, quantity?: string }
  const { itemNumber, lines } = await resolveBudgetLines(budgetLineKeys, manualItemNumber)

  const attachmentId = file
    ? await saveAttachment(file, `${inCharge}_${itemName}_請求書`)
    : null

  const entry = await insertEntry({
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
    attachmentId,
  }, lines)

  await notifyN8n('created', entry)
  setResponseStatus(event, 201)
  return toPublicEntry(entry, user.isAdmin)
})
