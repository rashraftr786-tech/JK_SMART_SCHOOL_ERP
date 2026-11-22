/**
 * JK SMART SCHOOLS ERP
 * Central application type definitions
 *
 * Keep APP_ROLES as the single source of truth for
 * all supported application roles.
 */

export const APP_ROLES = [
  'super_admin',
  'district_admin',
  'zone_admin',
  'school_admin',
  'teacher',
  'parent',
  'student',
] as const

/**
 * Application role type derived directly from APP_ROLES.
 */
export type AppRole = (typeof APP_ROLES)[number]

/**
 * User role assigned through the user_roles table.
 */
export type UserRole = {
  id: string
  role: AppRole
}

/**
 * Zone information.
 */
export type Zone = {
  id: string
  name: string
  district_id: string
  district: string
}

/**
 * School information.
 */
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

/**
 * District information.
 */
export type District = {
  id: string
  name: string
  state: string
}

/**
 * User profile information.
 */
export type Profile = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  is_active: boolean | null
  created_at: string | null
}

/**
 * Audit activity record.
 */
export type AuditLog = {
  id: number
  user_id: string | null
  action: string
  table_name: string | null
  record_id: string | null
  details: Record<string, unknown> | null
  created_at: string | null
}
