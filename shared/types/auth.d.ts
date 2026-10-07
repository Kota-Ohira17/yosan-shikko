declare module '#auth-utils' {
  interface User {
    email: string
    name: string
    isAdmin: boolean
  }
  interface UserSession {
    loggedInAt: number
  }
}

export {}
