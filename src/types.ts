export type AppRole = 'super_admin' | 'zone_admin' | 'school_admin' | 'teacher' | 'staff' | 'parent' | 'student'
export type UserRole = { id: string; role: AppRole }
export type Zone = { id: string; name: string; district: string; region: string; is_active: boolean }
export type School = { id: string; zone_id: string; name: string; udise_code: string; address: string | null; email: string | null; phone: string | null; is_active: boolean }
