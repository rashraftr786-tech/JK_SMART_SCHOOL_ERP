export const APP_ROLES = [
  'super_admin',
  'district_admin',
  'zone_admin',
  'school_admin',
  'teacher',
  'parent',
  'student',
] as const

export type AppRole = typeof APP_ROLES[number]
export type UserRole = { id: string; role: AppRole }
export type Zone = { id: string; name: string; district_id: string; district: string }
export type School = {
  id: string
  zone_id: string
  name: string
  udise_code: string
  address: string | null
  email: string | null
  phone: string | null
  is_active: boolean
}
export type District = { id: string; name: string; state: string }
export type Profile = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  is_active: boolean | null
  created_at: string | null
}
