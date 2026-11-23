import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Body = {
  role?: string; fullName?: string; email?: string; phone?: string; password?: string
  districtId?: string; zoneId?: string; schoolId?: string; designation?: string
}
const provisionable = new Set(['district_admin','zone_admin','school_admin','teacher','student','parent'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' })
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Sign in with an authorized account first.' })
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !service) return json(500, { error: 'Supabase function environment is incomplete.' })

  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  const caller = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: auth, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !auth.user) return json(401, { error: 'Session is invalid or expired.' })
  const actorId = auth.user.id
  const { data: profile, error: profileErr } = await admin.from('profiles').select('is_active').eq('id', actorId).maybeSingle()
  if (profileErr || !profile || profile.is_active === false) return json(403, { error: 'Account is inactive or profile could not be verified.' })

  let body: Body
  try { body = await req.json() as Body } catch { return json(400, { error: 'Request body must be valid JSON.' }) }
  const role = body.role?.trim() ?? '', fullName = body.fullName?.trim() ?? '', password = body.password ?? ''
  const email = body.email?.trim().toLowerCase() ?? '', phone = body.phone?.trim() ?? ''
  if (!provisionable.has(role)) return json(400, { error: 'Unsupported account role.' })
  if (fullName.length < 2 || fullName.length > 120) return json(400, { error: 'Full name must contain 2–120 characters.' })
  if (password.length < 10 || password.length > 72) return json(400, { error: 'Initial password must contain 10–72 characters.' })
  const phoneLogin = role === 'parent'
  if (phoneLogin && !/^\+[1-9]\d{7,14}$/.test(phone)) return json(400, { error: 'Parent mobile number must use international format, e.g. +91XXXXXXXXXX.' })
  if (!phoneLogin && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json(400, { error: 'Enter a valid email address.' })

  const needsDistrict = role === 'district_admin' || role === 'zone_admin'
  const needsZone = role === 'school_admin'
  const needsSchool = ['teacher','student'].includes(role)
  if (needsDistrict && (!body.districtId || !uuid.test(body.districtId))) return json(400, { error: 'Select a valid district.' })
  if (needsZone && (!body.zoneId || !uuid.test(body.zoneId))) return json(400, { error: 'Select a valid zone.' })
  if (needsSchool && (!body.schoolId || !uuid.test(body.schoolId))) return json(400, { error: 'Select a valid school.' })
  if (role === 'zone_admin' && (!body.zoneId || !uuid.test(body.zoneId))) return json(400, { error: 'Select a valid zone within the district.' })
  if (role === 'school_admin' && (!body.schoolId || !uuid.test(body.schoolId))) return json(400, { error: 'Select a school within the zone.' })

  const attributes = phoneLogin
    ? { phone, password, phone_confirm: true, user_metadata: { full_name: fullName } }
    : { email, password, email_confirm: true, user_metadata: { full_name: fullName } }
  const { data: created, error: createErr } = await admin.auth.admin.createUser(attributes)
  if (createErr || !created.user) return json(400, { error: createErr?.message ?? 'Could not create authentication account.' })
  const newId = created.user.id

  // The provision RPC runs with the caller JWT, validates actor scope and writes through
  // the existing audit triggers. Never use service-role writes for user_roles/assignments.
  const { error: provisionErr } = await caller.rpc('provision_user_access', {
    p_user_id: newId, p_role_name: role,
    p_district_id: body.districtId ?? null, p_zone_id: body.zoneId ?? null,
    p_school_id: body.schoolId ?? null, p_designation: body.designation?.trim() || null,
  })
  if (provisionErr) {
    const { error: rollbackErr } = await admin.auth.admin.deleteUser(newId)
    return json(403, { error: `Account provisioning was rejected: ${provisionErr.message}${rollbackErr ? `. Automatic account rollback also failed: ${rollbackErr.message}. Remove the unassigned Auth user manually.` : '. The newly created Auth user was rolled back.'}` })
  }

  // Profile is created by the existing auth.users trigger; phone is synchronised for parent login.
  if (phoneLogin) {
    const { error: phoneErr } = await admin.from('profiles').update({ phone }).eq('id', newId)
    if (phoneErr) return json(201, { success: true, userId: newId, role, warning: `Account and role were created, but profile phone synchronisation failed: ${phoneErr.message}` })
  }
  return json(201, { success: true, userId: newId, role, loginMethod: phoneLogin ? 'phone' : 'email', message: 'Account created and assigned within the permitted organizational scope.' })
})
