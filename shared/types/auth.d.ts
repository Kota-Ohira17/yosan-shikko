import type { Role } from '../roles'

declare module '#auth-utils' {
  interface User {
    email: string
    name: string
    role: Role
    /** 局長の担当局（局長以外は空） */
    bureau: string
  }
  interface UserSession {
    loggedInAt: number
  }
}

export {}
