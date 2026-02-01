export interface User {
  id: number
  email: string
  password: string
  name: string
  bio: string
  profileImage?: string
  isAdmin: boolean
  updateAt: string
  createAt: string
}
