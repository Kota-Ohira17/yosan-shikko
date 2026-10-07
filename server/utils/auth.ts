import type { H3Event } from 'h3'

export function isAdminEmail(email: string) {
  const { adminEmails } = useRuntimeConfig()
  return adminEmails
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase())
}

export function isAllowedEmail(email: string) {
  const { allowedEmailDomain } = useRuntimeConfig()
  return email.toLowerCase().endsWith(`@${allowedEmailDomain.toLowerCase()}`)
}

export async function loginAs(event: H3Event, email: string, name: string) {
  await setUserSession(event, {
    user: { email, name, isAdmin: isAdminEmail(email) },
    loggedInAt: Date.now(),
  })
}

export async function requireUser(event: H3Event) {
  const { user } = await requireUserSession(event)
  return user
}

export async function requireAdmin(event: H3Event) {
  const user = await requireUser(event)
  if (!user.isAdmin) {
    throw createError({ statusCode: 403, message: '会計担当のみ操作できます' })
  }
  return user
}
