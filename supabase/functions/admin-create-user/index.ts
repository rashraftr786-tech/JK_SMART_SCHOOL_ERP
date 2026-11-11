import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const allowedRoles = new Set([
  'super_admin', 'district_admin', 'zone_admin', 'school_admin', 'teacher', 'parent',
])

type CreateUserBody = {
  role?: string
  fullName?: string
  email?: string
  phone?: string
  password?: string
  districtId?: string
  zoneId?: string
  schoolId?: string
  designation?: string
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' })

  const authorization = request.headers.get('Authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'A signed-in administrator session is required.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: 'The Edge Function is missing required Supabase environment configuration.' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const caller = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) return json(401, { error: 'Your session is invalid or has expired. Sign in again.' })
  const actorId = authData.user.id

  const { data: actorRoles, error: actorRoleError } = await admin
    .from('user_roles')
    .select('roles!inner(role_name)')
    .eq('user_id', actorId)
  if (actorRoleError) return json(500, { error: 'Could not verify administrator permissions.' })
  const isSuperAdmin = (actorRoles ?? []).some((row: any) => {
    const linked = Array.isArray(row.roles) ? row.roles[0] : row.roles
    return linked?.role_name === 'super_admin'
  })
  if (!isSuperAdmin) return json(403, { error: 'Only a Super Administrator can create ERP accounts.' })

  const { data: actorProfile, error: actorProfileError } = await admin
    .from('profiles').select('is_active').eq('id', actorId).maybeSingle()
  if (actorProfileError || actorProfile?.is_active === false) {
    return json(403, { error: 'The administrator account is inactive or could not be verified.' })
  }

  let body: CreateUserBody
  try { body = await request.json() as CreateUserBody }
  catch { return json(400, { error: 'Request body must be valid JSON.' }) }

  const role = body.role?.trim() ?? ''
  const fullName = body.fullName?.trim() ?? ''
  const password = body.password ?? ''
  const email = body.email?.trim().toLowerCase() ?? ''
  const phone = body.phone?.trim() ?? ''

  if (!allowedRoles.has(role)) return json(400, { error: 'This role is not available for account provisioning.' })
  if (role === 'student') return json(409, { error: 'Student username provisioning is pending the protected username-mapping database change.' })
  if (fullName.length < 2 || fullName.length > 120) return json(400, { error: 'Enter a full name between 2 and 120 characters.' })
  if (password.length < 8 || password.length > 72) return json(400, { error: 'The initial password must be between 8 and 72 characters.' })

  const usesPhone = role === 'parent'
  if (usesPhone && !/^\+[1-9]\d{7,14}$/.test(phone)) {
    return json(400, { error: 'Enter the parent mobile number in international format, for example +91XXXXXXXXXX.' })
  }
  if (!usesPhone && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return json(400, { error: 'Enter a valid email address for this account.' })
  }

  if (role === 'district_admin' && !body.districtId) return json(400, { error: 'Select a district for this administrator.' })
  if (role === 'zone_admin' && !body.zoneId) return json(400, { error: 'Select a zone for this administrator.' })
  if ((role === 'school_admin' || role === 'teacher') && !body.schoolId) {
    return json(400, { error: 'Select a school for this account.' })
  }

  const { data: roleRow, error: roleLookupError } = await admin
    .from('roles').select('id').eq('role_name', role).maybeSingle()
  if (roleLookupError || !roleRow) return json(500, { error: `The configured ${role} role was not found in public.roles.` })

  if (role === 'district_admin') {
    const { data, error } = await admin.from('districts').select('id').eq('id', body.districtId).maybeSingle()
    if (error || !data) return json(400, { error: 'The selected district does not exist.' })
  }
  if (role === 'zone_admin') {
    const { data, error } = await admin.from('zones').select('id').eq('id', body.zoneId).maybeSingle()
    if (error || !data) return json(400, { error: 'The selected zone does not exist.' })
  }
  if (role === 'school_admin' || role === 'teacher') {
    const { data, error } = await admin.from('schools').select('id').eq('id', body.schoolId).maybeSingle()
    if (error || !data) return json(400, { error: 'The selected school does not exist.' })
  }

  const authAttributes = usesPhone
    ? { phone, password, phone_confirm: true, user_metadata: { full_name: fullName } }
    : { email, password, email_confirm: true, user_metadata: { full_name: fullName } }

  const { data: created, error: createError } = await admin.auth.admin.createUser(authAttributes)
  if (createError || !created.user) {
    return json(400, { error: createError?.message ?? 'Supabase could not create the authentication account.' })
  }
  const newUserId = created.user.id

  // The existing auth.users trigger creates public.profiles. Do not insert a second profile here.
  if (usesPhone) {
    const { error } = await admin.from('profiles').update({ phone }).eq('id', newUserId)
    if (error) {
      await admin.auth.admin.deleteUser(newUserId)
      return json(500, { error: `The profile was created but its phone number could not be saved: ${error.message}` })
    }
  }

  // Use the caller's JWT for RLS-protected writes so log_admin_change() can attribute
  // the user_roles INSERT to the actual signed-in Super Administrator via auth.uid().
  const { error: userRoleError } = await caller.from('user_roles').insert({
    user_id: newUserId,
    role_id: roleRow.id,
  })
  if (userRoleError) {
    await admin.auth.admin.deleteUser(newUserId)
    return json(500, { error: `The account was created but role assignment failed; the new account was rolled back. ${userRoleError.message}` })
  }

  let assignmentError: string | null = null
  if (role === 'district_admin') {
    const { error } = await caller.from('district_admin_assignments').upsert({
      user_id: newUserId, district_id: body.districtId, assigned_by: actorId, is_active: true,
    }, { onConflict: 'user_id,district_id' })
    if (error) assignmentError = error.message
  } else if (role === 'zone_admin') {
    const { error } = await caller.from('zone_admin_assignments').upsert({
      user_id: newUserId, zone_id: body.zoneId, assigned_by: actorId, is_active: true,
    }, { onConflict: 'user_id,zone_id' })
    if (error) assignmentError = error.message
  } else if (role === 'school_admin' || role === 'teacher') {
    const designation = body.designation?.trim() || (role === 'teacher' ? 'Teacher' : 'School Administrator')
    const { error } = await caller.from('school_memberships').upsert({
      user_id: newUserId, school_id: body.schoolId, designation, is_active: true,
    }, { onConflict: 'user_id,school_id' })
    if (error) assignmentError = error.message
  }

  if (assignmentError) {
    await admin.auth.admin.deleteUser(newUserId)
    return json(500, { error: `The account and role assignment could not be completed; the new account was rolled back. ${assignmentError}` })
  }

  return json(201, {
    success: true,
    userId: newUserId,
    role,
    loginMethod: usesPhone ? 'phone' : 'email',
    message: 'Account created. The existing profile trigger handled profile creation.',
  })
})
