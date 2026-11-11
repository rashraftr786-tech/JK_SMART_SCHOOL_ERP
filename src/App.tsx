import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  LogIn, LogOut, ShieldCheck, School as SchoolIcon, Users, MapPin, Plus,
  RefreshCw, AlertTriangle, LayoutDashboard, Building2, UserCog, ClipboardList,
  Settings, Activity, ChevronRight, Search, GraduationCap, CheckCircle2,
  UserPlus, Mail, Phone, KeyRound, Filter, LockKeyhole,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { UserRole, Zone, School, District, Profile, AppRole } from './types'

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Administrator',
  district_admin: 'District Administrator',
  zone_admin: 'Zone Administrator',
  school_admin: 'School Administrator',
  teacher: 'Teacher',
  parent: 'Parent / Guardian',
  student: 'Student',
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message)
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setRoles([])
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let active = true
    async function loadRoles() {
      if (!supabase || !session?.user) { setRoles([]); return }
      const { data, error } = await supabase
        .from('user_roles')
        .select('id, roles!inner(role_name)')
        .eq('user_id', session.user.id)
      if (!active) return
      if (error) setError(error.message)
      setRoles((data ?? []).map((row: any) => ({
        id: row.id,
        role: (Array.isArray(row.roles) ? row.roles[0]?.role_name : row.roles?.role_name) as AppRole,
      })).filter((row: UserRole) => Boolean(row.role)))
    }
    loadRoles()
    return () => { active = false }
  }, [session])

  if (!isSupabaseConfigured) return <SetupScreen />
  if (loading) return <div className="center-screen"><div className="loader" />Loading JK SMART SCHOOLS ERP…</div>
  if (!session) return <AuthScreen onError={setError} error={error} />
  return <Dashboard session={session} roles={roles} error={error} onSignOut={async () => { await supabase?.auth.signOut(); setRoles([]) }} />
}

function SetupScreen() {
  return <div className="center-screen"><div className="setup-card">
    <div className="brand-mark">JK</div><p className="eyebrow">PROJECT FOUNDATION</p>
    <h1>Connect your Supabase project</h1>
    <p className="muted">Create a <code>.env</code> file and add your Supabase Project URL and anon/publishable key.</p>
    <p className="security-note"><ShieldCheck size={17}/> Never place the Supabase service-role key in this application.</p>
  </div></div>
}

function AuthScreen({ onError, error }: { onError: (v: string) => void; error: string }) {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetMode, setResetMode] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault(); onError(''); setBusy(true)
    try {
      if (!supabase) throw new Error('Supabase is not configured.')
      if (resetMode) {
        if (!loginId.includes('@')) throw new Error('Enter the email address registered to your account to request a password reset.')
        const { error } = await supabase.auth.resetPasswordForEmail(loginId.trim(), {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
        })
        if (error) throw error
        onError('If this email belongs to an account and password recovery is enabled, a reset link has been sent.')
      } else {
        const identifier = loginId.trim()
        const credentials = identifier.includes('@') ? { email: identifier, password } : { phone: identifier, password }
        if (!identifier.includes('@') && !/^\+[1-9]\d{7,14}$/.test(identifier)) throw new Error('Enter your email address or mobile number in international format, for example +91XXXXXXXXXX.')
        const { error } = await supabase.auth.signInWithPassword(credentials)
        if (error) throw error
      }
    } catch (err) { onError(err instanceof Error ? err.message : 'Authentication failed.') }
    finally { setBusy(false) }
  }

  return <div className="auth-layout">
    <section className="auth-hero">
      <div className="brand-row"><div className="brand-mark">JK</div><span>SMART SCHOOLS ERP</span></div>
      <div className="hero-copy"><p className="eyebrow">ONE PLATFORM · EVERY SCHOOL</p><h1>Complete management.<br/><em>Connected education.</em></h1><p>A secure digital foundation for schools across Jammu and Kashmir.</p></div>
      <div className="hero-foot">ZONE WAGOORA · DISTRICT BARAMULLA</div>
    </section>
    <section className="auth-panel"><form className="auth-card" onSubmit={submit}>
      <p className="eyebrow">{resetMode ? 'ACCOUNT RECOVERY' : 'WELCOME BACK'}</p>
      <h2>{resetMode ? 'Reset your password' : 'Sign in to your account'}</h2>
      <p className="muted">Use the email address or registered mobile number issued by your school ERP administrator.</p>
      <label>{resetMode ? 'Email address' : 'Email address or mobile number'}<input type={resetMode ? 'email' : 'text'} required value={loginId} onChange={e=>setLoginId(e.target.value)} placeholder={resetMode ? 'name@example.com' : 'name@example.com or +91XXXXXXXXXX'} autoComplete="username"/></label>
      {!resetMode && <label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password"/></label>}
      {error && <div className="notice"><AlertTriangle size={17}/><span>{error}</span></div>}
      <button className="primary-btn" disabled={busy}>{busy ? 'Please wait…' : resetMode ? 'Send password reset link' : <><LogIn size={17}/> Sign in</>}</button>
      <p className="switch-auth"><button type="button" onClick={()=>{setResetMode(!resetMode);onError('')}}>{resetMode ? 'Return to sign in' : 'Forgot your password?'}</button></p>
      <p className="fine-print">Accounts are created and managed by the Super Administrator. Public self-registration is disabled.</p>
    </form></section>
  </div>
}

function Dashboard({ session, roles, error, onSignOut }: { session: Session; roles: UserRole[]; error: string; onSignOut: () => void }) {
  const [zones, setZones] = useState<Zone[]>([])
  const [districts, setDistricts] = useState<District[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [zoneName, setZoneName] = useState('')
  const [zoneDistrict, setZoneDistrict] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [udise, setUdise] = useState('')
  const [schoolZone, setSchoolZone] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSection, setActiveSection] = useState<'overview'|'users'>('overview')
  const isSuper = roles.some(r => r.role === 'super_admin')

  async function refresh() {
    if (!supabase) return
    const [d, z, s] = await Promise.all([
      supabase.from('districts').select('id,name,state').order('name'),
      supabase.from('zones').select('id,name,district_id').order('name'),
      supabase.from('schools').select('id,zone_id,school_name,udise_code,address,email,phone,is_active').order('school_name'),
    ])
    if (d.error) setMessage(`Districts: ${d.error.message}`); else setDistricts(d.data ?? [])
    if (z.error) setMessage(`Zones: ${z.error.message}`); else setZones((z.data ?? []).map((row: any) => ({
      id: row.id, name: row.name, district_id: row.district_id,
      district: d.data?.find((district: any) => district.id === row.district_id)?.name ?? '—',
    })) as Zone[])
    if (s.error) setMessage(`Schools: ${s.error.message}`); else setSchools((s.data ?? []).map((row: any) => ({
      id: row.id, zone_id: row.zone_id, name: row.school_name, udise_code: row.udise_code,
      address: row.address, email: row.email, phone: row.phone, is_active: row.is_active,
    })) as School[])
  }
  useEffect(() => { void refresh() }, [])

  async function addZone(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase!.from('zones').insert({ name: zoneName.trim(), district_id: zoneDistrict })
    setBusy(false)
    if (error) setMessage(error.message); else { setMessage('Zone registered successfully.'); setZoneName(''); void refresh() }
  }
  async function addSchool(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase!.from('schools').insert({
      zone_id: schoolZone, school_name: schoolName.trim(), udise_code: udise.trim(), email: schoolEmail.trim() || null,
    })
    setBusy(false)
    if (error) setMessage(error.message); else { setMessage('School registered successfully.'); setSchoolName(''); setUdise(''); setSchoolEmail(''); void refresh() }
  }

  const filteredSchools = schools.filter(s => `${s.name} ${s.udise_code}`.toLowerCase().includes(searchTerm.toLowerCase()))
  const activeSchools = schools.filter(s => s.is_active !== false).length
  const zoneBars = zones.map(z => ({ ...z, count: schools.filter(s => s.zone_id === z.id).length })).sort((a,b)=>b.count-a.count)
  const maxZoneCount = Math.max(1, ...zoneBars.map(z=>z.count))

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-row"><div className="brand-mark small">JK</div><div><b>SMART SCHOOLS</b><small>ERP PLATFORM</small></div></div>
      <div className="side-label">MAIN MENU</div>
      <button className={`side-item ${activeSection === 'overview' ? 'active' : ''}`} onClick={()=>setActiveSection('overview')}><LayoutDashboard size={18}/> Dashboard</button>
      {isSuper && <>
        <a className="side-item" href="#zone-management" onClick={()=>setActiveSection('overview')}><MapPin size={18}/> Zone Management</a>
        <a className="side-item" href="#school-registration" onClick={()=>setActiveSection('overview')}><Building2 size={18}/> School Registration</a>
        <a className="side-item" href="#schools" onClick={()=>setActiveSection('overview')}><SchoolIcon size={18}/> School Directory</a>
        <button className={`side-item ${activeSection === 'users' ? 'active' : ''}`} onClick={()=>setActiveSection('users')}><UserCog size={18}/> User Management</button>
        <a className="side-item" href="#activity" onClick={()=>setActiveSection('overview')}><ClipboardList size={18}/> Audit & Activity</a>
      </>}
      <div className="side-label side-label-lower">SYSTEM</div>
      <a className="side-item" href="#system-status" onClick={()=>setActiveSection('overview')}><Settings size={18}/> Settings</a>
      <div className="sidebar-bottom"><div className="avatar">{(session.user.email?.[0] ?? session.user.phone?.[0] ?? 'U').toUpperCase()}</div><div className="user-meta"><b>{session.user.email ?? session.user.phone}</b><small>{roles.map(r => r.role.replace(/_/g, ' ')).join(', ') || 'No role assigned'}</small></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><span className="muted">ZONE WAGOORA · DISTRICT BARAMULLA</span><h2>{activeSection === 'users' ? 'User & Role Management' : 'Administration Centre'}</h2></div><div className="topbar-actions"><span className="secure-pill"><span/> Secure workspace</span><button className="ghost-btn" onClick={onSignOut}><LogOut size={17}/> Sign out</button></div></header>
      {activeSection === 'users' && isSuper ?  <UserManagement districts={districts} zones={zones} schools={schools} /> : <div className="content" id="overview">
        {!roles.length && <div className="notice warning"><AlertTriangle size={18}/><span>Your account is authenticated but has no assigned role yet. Ask the Super Administrator to assign the appropriate role. No school records are available until then.</span></div>}
        {error && <div className="notice warning"><AlertTriangle size={17}/>{error}</div>}
        {message && <div className="notice"><span>{message}</span></div>}
        <section className="hero-banner"><div><p className="eyebrow">{isSuper ? 'SUPER ADMINISTRATOR · CONTROL CENTRE' : 'YOUR AUTHORISED WORKSPACE'}</p><h1>{isSuper ? 'One platform. Every school.' : 'Welcome to your workspace.'}</h1><p>Monitor the education network, manage registered institutions and oversee secure school administration.</p><div className="hero-tags"><span><CheckCircle2 size={14}/> Database connected</span><span><ShieldCheck size={14}/> Role-based access</span></div></div><div className="hero-emblem"><GraduationCap size={54}/><span>JK</span></div></section>
        <div className="section-title"><div><p className="eyebrow">LIVE OVERVIEW</p><h3>Network at a glance</h3></div><button className="icon-btn" onClick={()=>void refresh()}><RefreshCw size={16}/> Refresh data</button></div>
        <div className="stats-grid stats-grid-four">
          <Stat icon={<MapPin/>} label="Registered Zones" value={zones.length}/>
          <Stat icon={<SchoolIcon/>} label="Registered Schools" value={schools.length}/>
          <Stat icon={<CheckCircle2/>} label="Active Schools" value={activeSchools}/>
          <Stat icon={<Users/>} label="Your Assigned Roles" value={roles.length}/>
        </div>
        <div className="overview-grid">
          <section className="panel chart-panel"><div className="panel-heading"><div><h3>Schools by zone</h3><p className="muted">Distribution calculated from registered school records.</p></div><Activity/></div>
            {zoneBars.length ? <div className="bar-chart">{zoneBars.map(z=><div className="bar-row" key={z.id}><div className="bar-label"><span>{z.name}</span><b>{z.count}</b></div><div className="bar-track"><div className="bar-fill" style={{width:`${Math.max(z.count ? 7 : 0, z.count/maxZoneCount*100)}%`}}/></div></div>)}</div> : <div className="chart-empty">Zone statistics will appear when authorised zone records are available.</div>}
          </section>
          <section className="panel system-panel" id="system-status"><div className="panel-heading"><div><h3>Platform status</h3><p className="muted">Core service connection indicators.</p></div><ShieldCheck/></div><div className="system-status-row"><span className="status-dot"/> <div><b>Supabase connection</b><small>Connected to the project database</small></div><strong>Online</strong></div><div className="system-status-row"><span className="status-dot"/> <div><b>Authentication</b><small>Signed in as {session.user.email ?? session.user.phone}</small></div><strong>Active</strong></div><div className="system-status-row"><span className="status-dot"/> <div><b>Access control</b><small>Database policies apply to data access</small></div><strong>Enabled</strong></div></section>
        </div>
        {isSuper && <>
          <div className="section-title admin-section-title" id="administration"><div><p className="eyebrow">ADMINISTRATION TOOLS</p><h3>Manage your education network</h3></div></div>
          <div className="admin-grid">
            <section className="panel" id="zone-management"><div className="panel-heading"><div><h3>Zone management</h3><p className="muted">Create administrative zones using verified information.</p></div><MapPin/></div>
              <form onSubmit={addZone} className="stack-form"><label>Zone name<input required value={zoneName} onChange={e=>setZoneName(e.target.value)} placeholder="e.g. Wagoora"/></label><label>District<select required value={zoneDistrict} onChange={e=>setZoneDistrict(e.target.value)}><option value="">Select district</option>{districts.map(d=><option key={d.id} value={d.id}>{d.name} — {d.state}</option>)}</select></label><button className="primary-btn" disabled={busy || !zoneName.trim() || !zoneDistrict}><Plus size={16}/> Register zone</button></form>
              <div className="mini-list"><span>Existing zones</span><b>{zones.length}</b></div>
            </section>
            <section className="panel" id="school-registration"><div className="panel-heading"><div><h3>School registration</h3><p className="muted">Add an institution to its verified administrative zone.</p></div><SchoolIcon/></div>
              <form onSubmit={addSchool} className="stack-form"><label>Official school name<input required value={schoolName} onChange={e=>setSchoolName(e.target.value)} placeholder="Enter registered school name"/></label><label>UDISE code<input required value={udise} onChange={e=>setUdise(e.target.value)} placeholder="11-digit UDISE code" maxLength={11}/></label><label>Administrative zone<select required value={schoolZone} onChange={e=>setSchoolZone(e.target.value)}><option value="">Select zone</option>{zones.map(z=><option key={z.id} value={z.id}>{z.name} — {z.district}</option>)}</select></label><label>School email (optional)<input type="email" value={schoolEmail} onChange={e=>setSchoolEmail(e.target.value)} placeholder="school@example.com"/></label><button className="primary-btn" disabled={busy || !zones.length || !schoolName.trim() || !udise.trim()}><Plus size={16}/> Register school</button></form>
            </section>
          </div>
        </>}
        <section className="panel list-panel" id="schools"><div className="panel-heading directory-heading"><div><p className="eyebrow">INSTITUTION DIRECTORY</p><h3>Registered schools</h3><p className="muted">Only records visible under your database permissions are displayed.</p></div><div className="directory-tools"><label className="search-box"><Search size={16}/><input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search school or UDISE"/></label><button className="icon-btn" onClick={()=>void refresh()} title="Refresh"><RefreshCw size={17}/></button></div></div>
          <div className="table-wrap"><table><thead><tr><th>School / Institution</th><th>UDISE Code</th><th>District</th><th>Zone</th><th>Status</th></tr></thead><tbody>
            {filteredSchools.map(s=><tr key={s.id}><td><b>{s.name}</b><small>{s.email ?? 'No email configured'}</small></td><td>{s.udise_code}</td><td>{zones.find(z=>z.id===s.zone_id)?.district ?? '—'}</td><td>{zones.find(z=>z.id===s.zone_id)?.name ?? '—'}</td><td><span className={s.is_active?'status active':'status'}>{s.is_active?'Active':'Inactive'}</span></td></tr>)}
            {!filteredSchools.length && <tr><td colSpan={5} className="empty">{searchTerm ? 'No matching school records.' : 'No schools are visible in your authorised scope.'}</td></tr>}
          </tbody></table></div>
          <div className="table-foot"><span>Showing {filteredSchools.length} of {schools.length} registered school records</span><span>Data from central database <ChevronRight size={14}/></span></div>
        </section>
        <section className="panel activity-placeholder" id="activity"><div className="panel-heading"><div><h3>Administration activity</h3><p className="muted">Audit-log viewer will be enabled after the administrator activity feed is connected to the verified audit schema.</p></div><ClipboardList/></div><div className="activity-note"><ShieldCheck size={18}/> Administrative changes are being recorded by database audit triggers.</div></section>
        <p className="footer-note">JK SMART SCHOOLS ERP · ONE PLATFORM – EVERY SCHOOL – COMPLETE MANAGEMENT.</p>
      </div>}
    </main>
  </div>
}

function UserManagement({ districts, zones, schools }: { districts: District[]; zones: Zone[]; schools: School[] }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [userRoles, setUserRoles] = useState<{ user_id: string; role: AppRole }[]>([])
  const [role, setRole] = useState<AppRole>('district_admin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [districtId, setDistrictId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [designation, setDesignation] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<AppRole | 'all'>('all')
  const [busy, setBusy] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [notice, setNotice] = useState<{ kind: 'success'|'error'|'info'; text: string } | null>(null)

  const selectedZones = useMemo(() => zones.filter(z => !districtId || z.district_id === districtId), [zones, districtId])
  const roleCounts = useMemo(() => APP_ROLE_COUNTS(profiles, userRoles), [profiles, userRoles])
  const filteredProfiles = useMemo(() => profiles.filter(profile => {
    const assigned = userRoles.filter(item => item.user_id === profile.id)
    const matchesRole = roleFilter === 'all' || assigned.some(item => item.role === roleFilter)
    const haystack = `${profile.full_name} ${profile.email ?? ''} ${profile.phone ?? ''}`.toLowerCase()
    return matchesRole && haystack.includes(search.toLowerCase())
  }), [profiles, userRoles, roleFilter, search])

  async function loadUsers() {
    if (!supabase) return
    setLoadingUsers(true)
    const [profileResult, roleResult, roleCatalog] = await Promise.all([
      supabase.from('profiles').select('id,full_name,email,phone,is_active,created_at').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id,roles!inner(role_name)'),
      supabase.from('roles').select('role_name'),
    ])
    if (profileResult.error || roleResult.error || roleCatalog.error) {
      setNotice({ kind: 'error', text: profileResult.error?.message ?? roleResult.error?.message ?? roleCatalog.error?.message ?? 'Could not load user records.' })
    } else {
      setProfiles((profileResult.data ?? []) as Profile[])
      setUserRoles((roleResult.data ?? []).map((row: any) => ({
        user_id: row.user_id,
        role: (Array.isArray(row.roles) ? row.roles[0]?.role_name : row.roles?.role_name) as AppRole,
      })).filter((row: { role: AppRole }) => Boolean(row.role)))
    }
    setLoadingUsers(false)
  }
  useEffect(() => { void loadUsers() }, [])

  function resetForm() {
    setFullName(''); setEmail(''); setPhone(''); setPassword(''); setDistrictId(''); setZoneId(''); setSchoolId(''); setDesignation('')
  }

  async function createUser(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    if (role === 'student') {
      setNotice({ kind: 'info', text: 'Student username creation is intentionally held for the next approved database step. It needs a protected username mapping table; no student account has been created.' })
      return
    }
    setBusy(true); setNotice(null)
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          role, fullName: fullName.trim(), email: email.trim() || undefined,
          phone: phone.trim() || undefined, password,
          districtId: districtId || undefined, zoneId: zoneId || undefined,
          schoolId: schoolId || undefined, designation: designation.trim() || undefined,
        },
      })
      if (error) {
        const context = (error as any).context
        let detail = error.message
        try { if (context?.json) { const body = await context.json(); detail = body.error ?? body.message ?? detail } } catch { /* retain SDK message */ }
        throw new Error(detail)
      }
      if (data?.error) throw new Error(data.error)
      setNotice({ kind: 'success', text: `${ROLE_LABELS[role]} account created successfully. The existing database trigger created its profile. Provide the initial password to the user through a secure channel.` })
      resetForm()
      await loadUsers()
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Account creation failed.' })
    } finally { setBusy(false) }
  }

  const activeCount = profiles.filter(profile => profile.is_active !== false).length

  return <div className="content user-management-content">
    <section className="user-page-intro"><div><p className="eyebrow">SUPER ADMINISTRATOR · ACCESS CONTROL</p><h1>User & Role Management</h1><p>Provision authorised accounts and review the user directory. Privileged operations run through a protected Supabase Edge Function.</p></div><div className="user-intro-icon"><UserCog size={34}/></div></section>
    <div className="stats-grid stats-grid-four user-stats">
      <Stat icon={<Users/>} label="Total profiles" value={profiles.length}/>
      <Stat icon={<CheckCircle2/>} label="Active profiles" value={activeCount}/>
      <Stat icon={<ShieldCheck/>} label="Assigned roles" value={userRoles.length}/>
      <Stat icon={<GraduationCap/>} label="Student profiles" value={roleCounts.student}/>
    </div>
    <div className="user-layout-grid">
      <section className="panel create-user-panel">
        <div className="panel-heading"><div><p className="eyebrow">NEW ACCOUNT</p><h3>Create a user</h3><p className="muted">The selected role determines the login identifier and assignment fields.</p></div><UserPlus/></div>
        <form className="stack-form" onSubmit={createUser}>
          <label>User category<select value={role} onChange={e=>{setRole(e.target.value as AppRole);setNotice(null)}}>{Object.entries(ROLE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label>Full name<input required value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Enter full legal name" autoComplete="name"/></label>
          {role === 'parent' ? <label><span className="field-label-icon"><Phone size={14}/> Mobile number (international format)</span><input required type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" autoComplete="tel"/></label> : role !== 'student' ? <label><span className="field-label-icon"><Mail size={14}/> Email address</span><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email"/></label> : <div className="notice warning"><LockKeyhole size={17}/><span>A unique school-issued username will be generated after the protected student-login mapping is approved. No email address is required.</span></div>}
          <label><span className="field-label-icon"><KeyRound size={14}/> Initial password</span><input required type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password"/></label>
          {role === 'district_admin' && <label>Assigned district<select required value={districtId} onChange={e=>setDistrictId(e.target.value)}><option value="">Select district</option>{districts.map(d=><option key={d.id} value={d.id}>{d.name} — {d.state}</option>)}</select></label>}
          {role === 'zone_admin' && <><label>District filter<select value={districtId} onChange={e=>{setDistrictId(e.target.value);setZoneId('')}}><option value="">All districts</option>{districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Assigned zone<select required value={zoneId} onChange={e=>setZoneId(e.target.value)}><option value="">Select zone</option>{selectedZones.map(z=><option key={z.id} value={z.id}>{z.name} — {z.district}</option>)}</select></label></>}
          {(role === 'school_admin' || role === 'teacher') && <><label>District filter<select value={districtId} onChange={e=>{setDistrictId(e.target.value);setZoneId('');setSchoolId('')}}><option value="">All districts</option>{districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Zone filter<select value={zoneId} onChange={e=>{setZoneId(e.target.value);setSchoolId('')}}><option value="">All zones</option>{selectedZones.map(z=><option key={z.id} value={z.id}>{z.name} — {z.district}</option>)}</select></label><label>Assigned school<select required value={schoolId} onChange={e=>setSchoolId(e.target.value)}><option value="">Select school</option>{schools.filter(s=>!zoneId || s.zone_id===zoneId).map(s=><option key={s.id} value={s.id}>{s.name} ({s.udise_code})</option>)}</select></label>{role === 'teacher' && <label>Designation (optional)<input value={designation} onChange={e=>setDesignation(e.target.value)} placeholder="e.g. General Teacher"/></label>}</>}
          {role === 'student' && <div className="notice warning"><LockKeyhole size={17}/><span>Student usernames will be generated globally. This option remains read-only until the protected username mapping schema is approved and installed.</span></div>}
          {role === 'parent' && <div className="notice warning"><Phone size={17}/><span>Phone/password account provisioning requires Supabase Phone provider support. Child linking will be enabled after student accounts are provisioned.</span></div>}
          {notice && <div className={`notice ${notice.kind === 'error' ? 'warning' : ''}`}><AlertTriangle size={17}/><span>{notice.text}</span></div>}
          <button className="primary-btn" disabled={busy || role === 'student' || !fullName.trim() || !password || (role === 'parent' ? !phone.trim() : role !== 'student' && !email.trim()) || (role === 'district_admin' && !districtId) || (role === 'zone_admin' && !zoneId) || ((role === 'school_admin' || role === 'teacher') && !schoolId)}><Plus size={16}/>{busy ? 'Creating account…' : 'Create authorised account'}</button>
          <p className="form-footnote"><ShieldCheck size={14}/> Only the Super Administrator can provision accounts. The browser never receives the service-role key.</p>
        </form>
      </section>
      <section className="panel user-directory-panel">
        <div className="panel-heading directory-heading"><div><p className="eyebrow">ACCOUNT DIRECTORY</p><h3>Registered users</h3><p className="muted">Profile and role data are read under your existing Super Admin RLS policies.</p></div><button className="icon-btn" onClick={()=>void loadUsers()} title="Refresh users"><RefreshCw size={16}/></button></div>
        <div className="directory-tools user-directory-tools"><label className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email or phone"/></label><label className="filter-select"><Filter size={14}/><select value={roleFilter} onChange={e=>setRoleFilter(e.target.value as AppRole|'all')}><option value="all">All roles</option>{Object.entries(ROLE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
        <div className="table-wrap user-table-wrap"><table><thead><tr><th>User</th><th>Login ID</th><th>Role</th><th>Status</th></tr></thead><tbody>
          {filteredProfiles.map(profile=>{const assigned=userRoles.filter(item=>item.user_id===profile.id);return <tr key={profile.id}><td><b>{profile.full_name}</b><small>{profile.id.slice(0,8)}…</small></td><td>{profile.email ?? profile.phone ?? 'Not set'}</td><td><div className="role-chip-list">{assigned.map(item=><span className="role-chip" key={item.role}>{ROLE_LABELS[item.role] ?? item.role}</span>)}{!assigned.length && <span className="status">No role</span>}</div></td><td><span className={profile.is_active === false ? 'status' : 'status active'}>{profile.is_active === false ? 'Inactive' : 'Active'}</span></td></tr>})}
          {!loadingUsers && !filteredProfiles.length && <tr><td colSpan={4} className="empty">{profiles.length ? 'No users match these filters.' : 'No profiles are visible to this account.'}</td></tr>}
          {loadingUsers && <tr><td colSpan={4} className="empty">Loading user directory…</td></tr>}
        </tbody></table></div>
        <div className="table-foot"><span>Showing {filteredProfiles.length} of {profiles.length} profiles</span><span>Existing profile records · read only</span></div>
        <div className="role-count-grid">{Object.entries(ROLE_LABELS).map(([key,label])=><div key={key}><span>{label}</span><b>{roleCounts[key as AppRole]}</b></div>)}</div>
      </section>
    </div>
    <div className="user-security-note"><ShieldCheck size={18}/><div><b>Security boundary</b><span>Profile listing is protected by your current RLS policies. Account creation is performed by the admin-create-user Edge Function after it verifies the caller's Super Administrator role. Student username provisioning and account lifecycle controls are intentionally not enabled in this first implementation stage.</span></div></div>
    <p className="footer-note">JK SMART SCHOOLS ERP · USER & ROLE MANAGEMENT · PHASE 1</p>
  </div>
}

function APP_ROLE_COUNTS(profiles: Profile[], userRoles: { user_id: string; role: AppRole }[]) {
  const counts = Object.fromEntries(Object.keys(ROLE_LABELS).map(key => [key, 0])) as Record<AppRole, number>
  const profileIds = new Set(profiles.map(profile => profile.id))
  userRoles.forEach(item => { if (profileIds.has(item.user_id)) counts[item.role] += 1 })
  return counts
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>
}
