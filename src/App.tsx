import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { LogIn, LogOut, ShieldCheck, School as SchoolIcon, Users, MapPin, Plus, RefreshCw, AlertTriangle, LayoutDashboard, Building2, UserCog, ClipboardList, Settings, Activity, ChevronRight, Search, GraduationCap, CheckCircle2 } from 'lucide-react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { UserRole, Zone, School } from './types'

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
        .select('id, role_id, roles!inner(role_name)')
        .eq('user_id', session.user.id)
      if (!active) return
      if (error) setError(error.message)
      setRoles((data ?? []).map((row: any) => ({
        id: row.id,
        role: (Array.isArray(row.roles) ? row.roles[0]?.role_name : row.roles?.role_name) as UserRole['role']
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
    <p className="muted">Create a <code>.env</code> file from <code>.env.example</code>, then add your Supabase Project URL and anon/publishable key.</p>
    <p className="security-note"><ShieldCheck size={17}/> Never place the Supabase service-role key in this application.</p>
  </div></div>
}

function AuthScreen({ onError, error }: { onError: (v: string) => void; error: string }) {
  const [mode, setMode] = useState<'login'|'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault(); onError(''); setBusy(true)
    try {
      if (!supabase) throw new Error('Supabase is not configured.')
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } })
        if (error) throw error
        onError('Account request submitted. If email confirmation is enabled, verify your email before signing in. A Super Admin must assign your role.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
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
      <p className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</p>
      <h2>{mode === 'login' ? 'Sign in to your account' : 'Create an account'}</h2>
      <p className="muted">Use your authorised school ERP account.</p>
      {mode === 'signup' && <label>Full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name"/></label>}
      <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label>
      <label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
      {error && <div className="notice"><AlertTriangle size={17}/><span>{error}</span></div>}
      <button className="primary-btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? <><LogIn size={17}/> Sign in</> : 'Create account'}</button>
      <p className="switch-auth">{mode === 'login' ? 'New user?' : 'Already registered?'} <button type="button" onClick={()=>{setMode(mode==='login'?'signup':'login');onError('')}}>{mode === 'login' ? 'Create account' : 'Sign in'}</button></p>
      <p className="fine-print">Account creation does not grant access to school data. An authorised administrator must assign your role.</p>
    </form></section>
  </div>
}

function Dashboard({ session, roles, error, onSignOut }: { session: Session; roles: UserRole[]; error: string; onSignOut: () => void }) {
  const [zones, setZones] = useState<Zone[]>([])\n  const [districts, setDistricts] = useState<{id:string; name:string; state:string}[]>([])
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
  const isSuper = roles.some(r => r.role === 'super_admin')

  async function refresh() {
    if (!supabase) return
    const [d, z, s] = await Promise.all([
      supabase.from('districts').select('id,name,state').order('name'),
      supabase.from('zones').select('id,name,district_id').order('name'),
      supabase.from('schools').select('id,zone_id,school_name,udise_code,address,email,phone,is_active').order('school_name')
    ])
    if (d.error) setMessage(`Districts: ${d.error.message}`); else setDistricts(d.data ?? [])
    if (z.error) setMessage(`Zones: ${z.error.message}`); else setZones((z.data ?? []).map((row:any) => ({
      id: row.id, name: row.name, district_id: row.district_id,
      district: d.data?.find((district:any) => district.id === row.district_id)?.name ?? '—'
    })) as Zone[])
    if (s.error) setMessage(`Schools: ${s.error.message}`); else setSchools((s.data ?? []).map((row:any) => ({
      id: row.id, zone_id: row.zone_id, name: row.school_name, udise_code: row.udise_code,
      address: row.address, email: row.email, phone: row.phone, is_active: row.is_active
    })) as School[])
  }
  useEffect(() => { refresh() }, [])

  async function addZone(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase!.from('zones').insert({ name: zoneName.trim(), district_id: zoneDistrict })
    setBusy(false)
    if (error) setMessage(error.message); else { setMessage('Zone registered successfully.'); setZoneName(''); refresh() }
  }
  async function addSchool(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase!.from('schools').insert({
      zone_id: schoolZone, school_name: schoolName.trim(), udise_code: udise.trim(),
      email: schoolEmail.trim() || null
    })
    setBusy(false)
    if (error) setMessage(error.message); else { setMessage('School registered successfully.'); setSchoolName(''); setUdise(''); setSchoolEmail(''); refresh() }
  }

  const filteredSchools = schools.filter(s => `${s.name} ${s.udise_code}`.toLowerCase().includes(searchTerm.toLowerCase()))
  const activeSchools = schools.filter(s => s.is_active !== false).length
  const zoneBars = zones.map(z => ({ ...z, count: schools.filter(s => s.zone_id === z.id).length })).sort((a,b)=>b.count-a.count)
  const maxZoneCount = Math.max(1, ...zoneBars.map(z=>z.count))

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-row"><div className="brand-mark small">JK</div><div><b>SMART SCHOOLS</b><small>ERP PLATFORM</small></div></div>
      <div className="side-label">MAIN MENU</div>
      <a className="side-item active" href="#overview"><LayoutDashboard size={18}/> Dashboard</a>
      {isSuper && <>
        <a className="side-item" href="#zone-management"><MapPin size={18}/> Zone Management</a>
        <a className="side-item" href="#school-registration"><Building2 size={18}/> School Registration</a>
        <a className="side-item" href="#schools"><SchoolIcon size={18}/> School Directory</a>
        <a className="side-item" href="#administration"><UserCog size={18}/> User Management</a>
        <a className="side-item" href="#activity"><ClipboardList size={18}/> Audit & Activity</a>
      </>}
      <div className="side-label side-label-lower">SYSTEM</div>
      <a className="side-item" href="#system-status"><Settings size={18}/> Settings</a>
      <div className="sidebar-bottom"><div className="avatar">{(session.user.email?.[0] ?? 'U').toUpperCase()}</div><div className="user-meta"><b>{session.user.email}</b><small>{roles.map(r => r.role.replace(/_/g, ' ')).join(', ') || 'No role assigned'}</small></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><span className="muted">ZONE WAGOORA · DISTRICT BARAMULLA</span><h2>Administration Centre</h2></div><div className="topbar-actions"><span className="secure-pill"><span/> Secure workspace</span><button className="ghost-btn" onClick={onSignOut}><LogOut size={17}/> Sign out</button></div></header>
      <div className="content" id="overview">
        {!roles.length && <div className="notice warning"><AlertTriangle size={18}/><span>Your account is authenticated but has no assigned role yet. Ask the Super Administrator to assign the appropriate role. No school records are available until then.</span></div>}
        {error && <div className="notice warning"><AlertTriangle size={17}/>{error}</div>}
        {message && <div className="notice"><span>{message}</span></div>}
        <section className="hero-banner"><div><p className="eyebrow">{isSuper ? 'SUPER ADMINISTRATOR · CONTROL CENTRE' : 'YOUR AUTHORISED WORKSPACE'}</p><h1>{isSuper ? 'One platform. Every school.' : 'Welcome to your workspace.'}</h1><p>Monitor the education network, manage registered institutions and oversee secure school administration.</p><div className="hero-tags"><span><CheckCircle2 size={14}/> Database connected</span><span><ShieldCheck size={14}/> Role-based access</span></div></div><div className="hero-emblem"><GraduationCap size={54}/><span>JK</span></div></section>

        <div className="section-title"><div><p className="eyebrow">LIVE OVERVIEW</p><h3>Network at a glance</h3></div><button className="icon-btn" onClick={refresh}><RefreshCw size={16}/> Refresh data</button></div>
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
          <section className="panel system-panel" id="system-status"><div className="panel-heading"><div><h3>Platform status</h3><p className="muted">Core service connection indicators.</p></div><ShieldCheck/></div><div className="system-status-row"><span className="status-dot"/> <div><b>Supabase connection</b><small>Connected to the project database</small></div><strong>Online</strong></div><div className="system-status-row"><span className="status-dot"/> <div><b>Authentication</b><small>Signed in as {session.user.email}</small></div><strong>Active</strong></div><div className="system-status-row"><span className="status-dot"/> <div><b>Access control</b><small>Database policies apply to data access</small></div><strong>Enabled</strong></div></section>
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

        <section className="panel list-panel" id="schools"><div className="panel-heading directory-heading"><div><p className="eyebrow">INSTITUTION DIRECTORY</p><h3>Registered schools</h3><p className="muted">Only records visible under your database permissions are displayed.</p></div><div className="directory-tools"><label className="search-box"><Search size={16}/><input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search school or UDISE"/></label><button className="icon-btn" onClick={refresh} title="Refresh"><RefreshCw size={17}/></button></div></div>
          <div className="table-wrap"><table><thead><tr><th>School / Institution</th><th>UDISE Code</th><th>District</th><th>Zone</th><th>Status</th></tr></thead><tbody>
            {filteredSchools.map(s=><tr key={s.id}><td><b>{s.name}</b><small>{s.email ?? 'No email configured'}</small></td><td>{s.udise_code}</td><td>{zones.find(z=>z.id===s.zone_id)?.district ?? '—'}</td><td>{zones.find(z=>z.id===s.zone_id)?.name ?? '—'}</td><td><span className={s.is_active?'status active':'status'}>{s.is_active?'Active':'Inactive'}</span></td></tr>)}
            {!filteredSchools.length && <tr><td colSpan={5} className="empty">{searchTerm ? 'No matching school records.' : 'No schools are visible in your authorised scope.'}</td></tr>}
          </tbody></table></div>
          <div className="table-foot"><span>Showing {filteredSchools.length} of {schools.length} registered school records</span><span>Data from central database <ChevronRight size={14}/></span></div>
        </section>
        <section className="panel activity-placeholder" id="activity"><div className="panel-heading"><div><h3>Administration activity</h3><p className="muted">Audit-log viewer will be enabled after the administrator activity feed is connected to the verified audit schema.</p></div><ClipboardList/></div><div className="activity-note"><ShieldCheck size={18}/> Administrative changes are being recorded by database audit triggers.</div></section>
        <p className="footer-note">JK SMART SCHOOLS ERP · ONE PLATFORM – EVERY SCHOOL – COMPLETE MANAGEMENT.</p>
      </div>
    </main>
  </div>
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>
}
