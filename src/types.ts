export type AppRole = 'super_admin' | 'district_admin' | 'zone_admin' | 'school_admin' | 'teacher' | 'parent' | 'student'
export type UserRole = { id: string; role_id: string; role: { role_name: AppRole } | null }
export type Zone = { id: string; district_id: string; name: string }
export type School = { id: string; zone_id: string; school_name: string; udise_code: string; address: string | null; email: string | null; phone: string | null; is_active: boolean }
