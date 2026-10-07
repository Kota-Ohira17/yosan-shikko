import type { Role } from '../roles'

declare module '#auth-utils' {
  interface User {
    email: string
    name: string
    role: Role
  }
  interface UserSession {
    loggedInAt: number
  }
}

export {}
