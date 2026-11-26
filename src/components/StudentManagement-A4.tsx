import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Search, UserPlus, RefreshCw, GraduationCap, FileText, X, CheckCircle2, AlertCircle, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

type Props = { schoolId: string; session: Session }
type SessionRow = { id: string; session_name: string; is_current: boolean }
type ClassRow = { id: string; class_name: string; display_order: number }
type StudentRow = { id: string; first_name: string; middle_name: string | null; last_name: string | null; gender: string | null; date_of_birth: string | null; father_name: string | null; admissions: { id: string; admission_no: string | null; admission_status: string; session: { session_name: string } | null; class: { class_name: string } | null }[] }

const DOCUMENTS = [
  ['student_photo', 'Student Photograph', true], ['birth_certificate', 'Birth Certificate', true],
  ['residence_proof', 'Residence Proof', true], ['aadhaar_card', 'Student Aadhaar Card', true], ['ration_card_eticket', 'Ration Card (E-Ticket)', true],
  ['blood_group_report', 'Blood Group Test Report', true], ['bank_passbook', 'Bank Passbook', true],
  ['transfer_certificate', 'Transfer Certificate', false], ['other', 'Other Supporting Document', false],
] as const

type FormState = Record<string, string>
const initial: FormState = {
  first_name:'', middle_name:'', last_name:'', aadhaar_name_first:'', aadhaar_name_middle:'', aadhaar_name_last:'',
  father_first_name:'', father_middle_name:'', father_last_name:'', mother_first_name:'', mother_middle_name:'', mother_last_name:'',
  guardian_name:'', guardian_relationship:'', father_education:'', mother_education:'', guardian_education:'', email:'', gender:'',
  residence:'', tehsil:'', district:'', father_phone:'', mother_phone:'', aadhaar_number:'', date_of_birth:'', dob_in_words:'',
  bank_account_number:'', bank_name:'', bank_branch:'', ifsc_code:'', category:'', blood_group:'', ration_card_number:'',
  ration_card_type:'', pen_number:'', admission_no:'', admission_date:new Date().toISOString().slice(0,10),
  academic_session_id:'', class_id:'', admission_status:'submitted',
}

export default function StudentManagement({ schoolId, session }: Props) {
  const [rows, setRows] = useState<StudentRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [form, setForm] = useState<FormState>(initial)
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [parentDeclaration, setParentDeclaration] = useState(false)
  const [newSessionName, setNewSessionName] = useState('2026-27')
  const [newSessionStart, setNewSessionStart] = useState('2026-04-01')
  const [newSessionEnd, setNewSessionEnd] = useState('2027-03-31')
  const [newClassName, setNewClassName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<{kind:'success'|'error'; text:string}|null>(null)

  async function load() {
    if (!supabase) return
    setLoading(true); setNotice(null)
    const [studentResult, sessionResult, classResult] = await Promise.all([
      supabase.from('erp_students').select('id,first_name,middle_name,last_name,gender,date_of_birth,father_name,admissions:erp_student_admissions(id,admission_no,admission_status,session:erp_academic_sessions(session_name),class:erp_school_classes(class_name))').eq('school_id', schoolId).order('created_at', { ascending:false }),
      supabase.from('erp_academic_sessions').select('id,session_name,is_current').eq('school_id', schoolId).order('start_date', {ascending:false}),
      supabase.from('erp_school_classes').select('id,class_name,display_order').eq('school_id', schoolId).eq('is_active',true).order('display_order'),
    ])
    if (studentResult.error || sessionResult.error || classResult.error) {
      setNotice({kind:'error',text:studentResult.error?.message || sessionResult.error?.message || classResult.error?.message || 'Unable to load student records.'})
    } else {
      setRows((studentResult.data ?? []) as unknown as StudentRow[])
      setSessions((sessionResult.data ?? []) as SessionRow[])
      setClasses((classResult.data ?? []) as ClassRow[])
      const current = (sessionResult.data ?? []).find((s:any)=>s.is_current)
      if (current) setForm(f=>({...f,academic_session_id:f.academic_session_id || current.id}))
    }
    setLoading(false)
  }
  useEffect(()=>{ void load() },[schoolId])

  const filtered = useMemo(()=>rows.filter(r=>`${r.first_name} ${r.middle_name??''} ${r.last_name??''} ${r.father_name??''}`.toLowerCase().includes(query.toLowerCase())),[rows,query])
  const set = (key:string,value:string)=>setForm(f=>({...f,[key]:value}))

  const htmlEscape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] as string))
  const fullName = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' ')
  const printAdmission = async (studentId: string) => {
    if (!supabase) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setNotice({kind:'error',text:'Please allow pop-ups for this site, then try downloading the A4 admission form again.'})
      return
    }
    printWindow.document.write('<!doctype html><title>Preparing admission form…</title><p style="font:16px Arial;padding:24px">Preparing secure admission form…</p>')
    printWindow.document.close()
    try {
      const {data:student,error} = await supabase.from('erp_students').select('*, admissions:erp_student_admissions(*, session:erp_academic_sessions(session_name), class:erp_school_classes(class_name)), documents:erp_student_documents(document_type,storage_path,verification_status)').eq('id',studentId).eq('school_id',schoolId).single()
      if (error) throw error
      const admission = (student.admissions ?? []).slice().sort((a:any,b:any)=>String(b.created_at??'').localeCompare(String(a.created_at??'')))[0]
      if (!admission) throw new Error('No admission record is available for this student.')
      const photoDoc = (student.documents ?? []).find((d:any)=>d.document_type==='student_photo' && d.storage_path && ['uploaded','verified'].includes(d.verification_status))
      let photoUrl = ''
      if (photoDoc) {
        const {data:photo,error:photoError} = await supabase.storage.from('student-admission-documents').createSignedUrl(photoDoc.storage_path,60)
        if (!photoError) photoUrl = photo.signedUrl
      }
      const field = (label:string,value:unknown,wide=false) => `<div class="field ${wide?'wide':''}"><b>${htmlEscape(label)}</b><span>${htmlEscape(value) || '&nbsp;'}</span></div>`
      const name = fullName(student.first_name,student.middle_name,student.last_name)
      const father = fullName(student.father_first_name,student.father_middle_name,student.father_last_name) || student.father_name
      const mother = fullName(student.mother_first_name,student.mother_middle_name,student.mother_last_name) || student.mother_name
      const dob = student.date_of_birth ? new Date(`${student.date_of_birth}T00:00:00`).toLocaleDateString('en-GB') : ''
      const body = `<!doctype html><html><head><meta charset="utf-8"><title>Admission Form - ${htmlEscape(name)}</title><style>
        @page{size:A4 portrait;margin:7mm}*{box-sizing:border-box}html,body{margin:0;padding:0;color:#111;font-family:Arial,Helvetica,sans-serif}body{font-size:8pt;line-height:1.18}.sheet{width:100%;height:283mm;overflow:hidden;border:1px solid #333;padding:5mm 6mm;position:relative}.head{display:flex;align-items:center;justify-content:center;text-align:center;border-bottom:2px solid #176044;padding:0 0 3mm;margin-bottom:2mm}.head h1{font-size:15pt;color:#155638;margin:0 0 2px}.head p{font-size:7.5pt;margin:1px}.title{text-align:center;font-size:11pt;font-weight:bold;text-decoration:underline;margin:2mm 0 3mm}.photo{position:absolute;right:6mm;top:28mm;width:25mm;height:30mm;border:1px solid #555;display:flex;align-items:center;justify-content:center;text-align:center;font-size:7pt;color:#666;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover}.section{font-size:8.5pt;font-weight:bold;color:#155638;border-bottom:1px solid #777;padding:1.2mm 0 .7mm;margin:2mm 0 1.2mm}.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:1.5mm 2mm}.field{grid-column:span 4;min-width:0}.field.half{grid-column:span 6}.field.third{grid-column:span 4}.field.wide{grid-column:span 12}.field b{display:block;font-size:6.6pt;margin-bottom:.4mm;color:#333}.field span{display:block;min-height:5mm;border-bottom:1px solid #777;padding:0 1mm 1mm;overflow-wrap:anywhere}.photo-space{padding-right:28mm}.declaration{font-size:7pt;text-align:justify;line-height:1.3;margin:2mm 0}.office{border:1px solid #555;padding:2mm;margin-top:2mm}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm;margin-top:9mm;text-align:center;font-size:7pt}.signatures div{border-top:1px solid #333;padding-top:1mm}.foot{font-size:6pt;text-align:center;margin-top:2mm;color:#555}@media screen{body{background:#eee;padding:10px}.sheet{background:white;max-width:196mm;margin:auto;box-shadow:0 2px 12px #0002}}@media print{.sheet{border:0;padding:0;height:283mm}}
        </style></head><body><main class="sheet"><header class="head"><div><h1>GOVERNMENT PRIMARY SCHOOL PETHGAM WAGOORA</h1><p>Wagoora Babareshi Road, Near Zonal Education Office, Wagoora</p><p>Email: pspethgam@gmail.com &nbsp; | &nbsp; UDISE Code: 01022202207</p></div></header><div class="title">STUDENT ADMISSION FORM</div><div class="photo">${photoUrl?`<img src="${htmlEscape(photoUrl)}" alt="Student photograph">`:'STUDENT PHOTO'}</div>
        <div class="section">1. Student details</div><div class="grid photo-space">${field('Student name',name,true)}${field('Name as per Aadhaar',fullName(student.aadhaar_name_first,student.aadhaar_name_middle,student.aadhaar_name_last),true)}${field('Gender',student.gender)}${field('Date of birth',dob)}${field('DOB in words',student.dob_in_words,true)}</div>
        <div class="section">2. Parents and legal guardian</div><div class="grid">${field("Father's name",father,true)}${field("Mother's name",mother,true)}${field('Legal guardian',student.guardian_name)}${field('Relationship',student.guardian_relationship)}${field("Father's education",student.father_education)}${field("Mother's education",student.mother_education)}${field("Guardian's education",student.guardian_education)}${field('Contact email',student.email,true)}</div>
        <div class="section">3. Address and contact</div><div class="grid">${field('Residence / village',student.residence,true)}${field('Tehsil',student.tehsil)}${field('District',student.district)}${field("Father's contact",student.father_phone)}${field("Mother's contact",student.mother_phone)}</div>
        <div class="section">4. Identity and additional information</div><div class="grid">${field('Aadhaar number',student.aadhaar_number)}${field('Category',student.category)}${field('Blood group',student.blood_group)}${field('Ration card number',student.ration_card_number)}${field('Ration card type',student.ration_card_type)}${field('PEN number',student.pen_number)}</div>
        <div class="section">5. Bank details</div><div class="grid">${field('Bank account number',student.bank_account_number)}${field('Bank name',student.bank_name)}${field('Bank branch',student.bank_branch)}${field('IFSC code',student.ifsc_code)}</div>
        <div class="section">6. Admission and academic details</div><div class="grid">${field('Academic session',admission.session?.session_name)}${field('Class joining',admission.class?.class_name)}${field('Admission number',admission.admission_no)}${field('Admission date',admission.admission_date?new Date(`${admission.admission_date}T00:00:00`).toLocaleDateString('en-GB'):'')}${field('Admission status',String(admission.admission_status??'').replace(/_/g,' '))}</div>
        <div class="section">Parent / Guardian declaration</div><p class="declaration">I hereby declare that the information furnished above is true and correct to the best of my knowledge and belief. I agree to abide by the rules and regulations of the school and the Department. I understand that the information and supporting documents may be verified by the school authorities.</p>
        <div class="office"><b>FOR OFFICE USE ONLY</b><div class="grid" style="margin-top:2mm">${field('Admission number',admission.admission_no)}${field('Admitted in class',admission.class?.class_name)}${field('Date of admission',admission.admission_date)}${field('Documents verified by','')}${field('Verification remarks','',true)}</div></div>
        <div class="signatures"><div>Signature of Parent / Guardian</div><div>Signature of Admission Incharge</div><div>Signature of Headmaster</div></div><p class="foot">Generated from the school's online admission record. Handle this document as confidential student information.</p></main><script>window.addEventListener('load',()=>{const imgs=[...document.images];Promise.all(imgs.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r}))).then(()=>setTimeout(()=>window.print(),250))});</script></body></html>`
      printWindow.document.open(); printWindow.document.write(body); printWindow.document.close()
    } catch (err:any) {
      printWindow.close()
      setNotice({kind:'error',text:err?.message || 'Unable to prepare the admission form.'})
    }
  }

  async function addAcademicSession(e:FormEvent) {
    e.preventDefault(); if(!supabase) return
    const {error}=await supabase.from('erp_academic_sessions').insert({school_id:schoolId,session_name:newSessionName.trim(),start_date:newSessionStart,end_date:newSessionEnd,is_current:sessions.length===0,created_by:session.user.id})
    if(error) setNotice({kind:'error',text:error.message}); else {setNotice({kind:'success',text:'Academic session created.'}); await load()}
  }
  async function addClass(e:FormEvent) {
    e.preventDefault(); if(!supabase) return
    const {error}=await supabase.from('erp_school_classes').insert({school_id:schoolId,class_name:newClassName.trim(),display_order:classes.length+1})
    if(error) setNotice({kind:'error',text:error.message}); else {setNewClassName('');setNotice({kind:'success',text:'Class created.'});await load()}
  }
  const input = (label:string,key:string,type='text',required=false,placeholder='') => <label className="adm-field"><span>{label}{required?' *':''}</span><input type={type} value={form[key]??''} required={required} placeholder={placeholder} onChange={e=>set(key,e.target.value)} /></label>
  const select = (label:string,key:string,options:string[],required=false)=><label className="adm-field"><span>{label}{required?' *':''}</span><select value={form[key]??''} required={required} onChange={e=>set(key,e.target.value)}><option value="">Select</option>{options.map(o=><option key={o}>{o}</option>)}</select></label>

  async function submit(e:FormEvent) {
    e.preventDefault(); if(!supabase) return
    if(!parentDeclaration) { setNotice({kind:'error',text:'Please confirm the parent declaration before submitting the admission.'}); return }
    if(!form.academic_session_id || !form.class_id) { setNotice({kind:'error',text:'Please select an academic session and joining class. Create these in the academic setup first.'}); return }
    setSaving(true); setNotice(null)
    try {
      const studentPayload = {
        school_id:schoolId, created_by:session.user.id, first_name:form.first_name.trim(), middle_name:form.middle_name.trim()||null, last_name:form.last_name.trim()||null,
        aadhaar_name_first:form.aadhaar_name_first||null, aadhaar_name_middle:form.aadhaar_name_middle||null, aadhaar_name_last:form.aadhaar_name_last||null,
        father_name:[form.father_first_name,form.father_middle_name,form.father_last_name].filter(Boolean).join(' ')||null,
        father_first_name:form.father_first_name||null,father_middle_name:form.father_middle_name||null,father_last_name:form.father_last_name||null,
        mother_name:[form.mother_first_name,form.mother_middle_name,form.mother_last_name].filter(Boolean).join(' ')||null,
        mother_first_name:form.mother_first_name||null,mother_middle_name:form.mother_middle_name||null,mother_last_name:form.mother_last_name||null,
        guardian_name:form.guardian_name||null,guardian_relationship:form.guardian_relationship||null,
        father_education:form.father_education||null,mother_education:form.mother_education||null,guardian_education:form.guardian_education||null,
        email:form.email||null,gender:form.gender||null,residence:form.residence||null,tehsil:form.tehsil||null,district:form.district||null,
        father_phone:form.father_phone||null,mother_phone:form.mother_phone||null,aadhaar_number:form.aadhaar_number||null,date_of_birth:form.date_of_birth||null,dob_in_words:form.dob_in_words||null,
        bank_account_number:form.bank_account_number||null,bank_name:form.bank_name||null,bank_branch:form.bank_branch||null,ifsc_code:form.ifsc_code||null,
        category:form.category||null,blood_group:form.blood_group||null,ration_card_number:form.ration_card_number||null,ration_card_type:form.ration_card_type||null,
        pen_number:form.pen_number||null,
      }
      const {data:student,error:studentError}=await supabase.from('erp_students').insert(studentPayload).select('id').single()
      if(studentError) throw studentError
      const {data:admission,error:admissionError}=await supabase.from('erp_student_admissions').insert({
        school_id:schoolId,student_id:student.id,academic_session_id:form.academic_session_id,class_id:form.class_id,
        admission_no:form.admission_no||null,admission_date:form.admission_date,admission_status:form.admission_status,parent_declaration_confirmed:true,parent_declaration_confirmed_at:new Date().toISOString(),
        created_by:session.user.id,
      }).select('id').single()
      if(admissionError) { await supabase.from('erp_students').delete().eq('id',student.id); throw admissionError }
      const docRows=[] as any[]
      for(const [code,label,required] of DOCUMENTS) {
        if(code==='transfer_certificate' && !files[code]) continue
        const file=files[code]
        let path:string|null=null
        if(file) {
          const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_')
          path=`${schoolId}/${student.id}/${admission.id}/${code}-${Date.now()}-${safeName}`
          const {error:uploadError}=await supabase.storage.from('student-admission-documents').upload(path,file,{upsert:false,contentType:file.type})
          if(uploadError) throw uploadError
        }
        docRows.push({school_id:schoolId,student_id:student.id,admission_id:admission.id,document_type:code,document_label:label,is_required:required,storage_path:path,verification_status:file?'uploaded':'pending',uploaded_by:file?session.user.id:null,uploaded_at:file?new Date().toISOString():null})
      }
      const {error:docError}=await supabase.from('erp_student_documents').insert(docRows)
      if(docError) throw docError
      setNotice({kind:'success',text:'Admission record created. Uploaded documents are awaiting verification; missing documents remain pending.'})
      setForm(initial); setFiles({}); setParentDeclaration(false); setShowForm(false); await load()
    } catch(err:any) {
      setNotice({kind:'error',text:err?.message || 'Unable to save admission. Please check the form and database migration.'})
    } finally { setSaving(false) }
  }

  return <section className="student-management">
    <div className="student-head"><div><p className="eyebrow">SCHOOL OPERATIONS</p><h1>Student Management</h1><p>Admissions, student records and academic-session enrolment.</p></div><button className="primary-btn" onClick={()=>{setNotice(null);setShowForm(v=>!v)}}><UserPlus size={17}/>{showForm?'Close admission form':'New admission'}</button></div>
    {notice&&<div className={`adm-notice ${notice.kind}`}><span>{notice.kind==='success'?<CheckCircle2 size={18}/>:<AlertCircle size={18}/>}</span>{notice.text}<button onClick={()=>setNotice(null)} aria-label="Dismiss"><X size={16}/></button></div>}
    {(!sessions.length || !classes.length) && <div className="panel adm-setup-panel"><div><h2>Academic setup required</h2><p>Create your school's academic session and class list before registering admissions.</p></div><div className="adm-setup-grid"><form onSubmit={addAcademicSession}><b>New academic session</b><input required value={newSessionName} onChange={e=>setNewSessionName(e.target.value)} placeholder="2026-27"/><div><input required type="date" value={newSessionStart} onChange={e=>setNewSessionStart(e.target.value)}/><input required type="date" value={newSessionEnd} onChange={e=>setNewSessionEnd(e.target.value)}/></div><button className="primary-btn" type="submit">Add session</button></form><form onSubmit={addClass}><b>Add class</b><input required value={newClassName} onChange={e=>setNewClassName(e.target.value)} placeholder="Nursery / LKG / Class 1"/><button className="primary-btn" type="submit">Add class</button></form></div></div>}
    {showForm&&<form className="panel admission-form" onSubmit={submit}>
      <div className="adm-form-title"><div><h2>Student Admission Form</h2><p>Enter information as provided on the school's admission form.</p></div><span>Academic session based</span></div>
      <div className="adm-section"><h3>1. Student's name</h3><div className="adm-grid three">{input('First name','first_name','text',true)}{input('Middle name','middle_name')}{input('Last name','last_name')}</div><h4>Name as per Aadhaar</h4><div className="adm-grid three">{input('First name','aadhaar_name_first')}{input('Middle name','aadhaar_name_middle')}{input('Last name','aadhaar_name_last')}</div></div>
      <div className="adm-section"><h3>2. Parents and legal guardian</h3><h4>Father's name</h4><div className="adm-grid three">{input('First name','father_first_name')}{input('Middle name','father_middle_name')}{input('Last name','father_last_name')}</div><h4>Mother's name</h4><div className="adm-grid three">{input('First name','mother_first_name')}{input('Middle name','mother_middle_name')}{input('Last name','mother_last_name')}</div><div className="adm-grid three">{input('Legal guardian full name','guardian_name')}{input('Relationship','guardian_relationship')}{input("Guardian's education",'guardian_education')}</div><div className="adm-grid three">{input("Father's highest education",'father_education')}{input("Mother's highest education",'mother_education')}{input('Contact email','email','email')}</div></div>
      <div className="adm-section"><h3>3. Address and contact</h3><div className="adm-grid two">{input('Residence / village','residence')}{input('Tehsil','tehsil')}{input('District','district')}{select('Gender','gender',['Female','Male','Other'],true)}{input("Father's contact number",'father_phone','tel')}{input("Mother's contact number",'mother_phone','tel')}</div></div>
      <div className="adm-section"><h3>4. Identity and date of birth</h3><div className="adm-grid two">{input('Aadhaar number (restricted access)','aadhaar_number','text',false,'Enter only when required')}{input('Date of birth','date_of_birth','date',true)}{input('Date of birth in words','dob_in_words')}</div><p className="adm-privacy">Aadhaar and financial information are sensitive. Access is restricted to authorised school administrators; do not upload or share these details publicly.</p></div>
      <div className="adm-section"><h3>5. Bank details</h3><div className="adm-grid two">{input('Bank account number','bank_account_number')}{input('Bank name','bank_name')}{input('Bank branch','bank_branch')}{input('IFSC code','ifsc_code')}</div></div>
      <div className="adm-section"><h3>6. Additional details</h3><div className="adm-grid two">{select('Category','category',['GENERAL','OBC','SC','ST','Other'])}{select('Blood group','blood_group',['A+','A-','B+','B-','AB+','AB-','O+','O-'])}{input('Ration card number','ration_card_number')}{select('Ration card type','ration_card_type',['AAY','PHH','NPHH','Other'])}{input('PEN number (transferring students)','pen_number')}</div></div>
      <div className="adm-section"><h3>7. Admission and academic session</h3><div className="adm-grid two"><label className="adm-field"><span>Academic session *</span><select required value={form.academic_session_id} onChange={e=>set('academic_session_id',e.target.value)}><option value="">Select session</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.session_name}{s.is_current?' (Current)':''}</option>)}</select></label><label className="adm-field"><span>Class joining *</span><select required value={form.class_id} onChange={e=>set('class_id',e.target.value)}><option value="">Select class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.class_name}</option>)}</select></label>{input('Admission number','admission_no')}{input('Admission date','admission_date','date',true)}{select('Admission status','admission_status',['submitted','under_review','provisionally_admitted','confirmed'])}</div>{(!sessions.length||!classes.length)&&<p className="adm-privacy">Academic setup is incomplete: create at least one academic session and one class before registering admissions.</p>}</div>
      <div className="adm-section"><h3>8. Supporting documents</h3><p className="adm-help">Upload PDF, JPG or PNG files. Required documents can remain pending and be added later. Transfer Certificate is required only for applicable transfer admissions.</p><div className="adm-doc-grid">{DOCUMENTS.map(([code,label,required])=><label className="adm-doc-field" key={code}><span><FileText size={16}/><b>{label}</b>{required&&<i>Required</i>}</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>setFiles(f=>({...f,[code]:e.target.files?.[0]??null}))}/><small>{files[code]?.name??(required?'Pending if not uploaded':'Optional / if applicable')}</small></label>)}</div></div>
      <div className="adm-declaration"><label><input type="checkbox" checked={parentDeclaration} onChange={e=>setParentDeclaration(e.target.checked)}/> I hereby declare that the information provided in this admission form is true and correct to the best of my knowledge. I understand that supporting documents may be verified by the school.</label></div>
      <div className="adm-submit-row"><p>Saving creates the student record and a session-specific admission. Document verification is a separate process.</p><button className="primary-btn" type="submit" disabled={saving||!sessions.length||!classes.length}>{saving?'Saving admission…':'Save admission'}</button></div>
    </form>}
    <div className="panel student-directory"><div className="student-directory-head"><div><h2>Student directory</h2><p>{filtered.length} student record(s) in this school</p></div><div className="adm-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, father or admission no."/><button onClick={()=>void load()} aria-label="Refresh students"><RefreshCw size={16}/></button></div></div>
      {loading?<div className="adm-empty"><div className="loader"/> Loading student records…</div>:filtered.length===0?<div className="adm-empty"><GraduationCap size={30}/><b>No student records found</b><span>Use New admission to register the first student, or change your search.</span></div>:<div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Student</th><th>Father / Guardian</th><th>Admission No.</th><th>Session</th><th>Class</th><th>Admission status</th></tr></thead><tbody>{filtered.map(r=>{const a=r.admissions?.[0];return <tr key={r.id}><td><b>{[r.first_name,r.middle_name,r.last_name].filter(Boolean).join(' ')}</b><small>{r.gender||'—'} · {r.date_of_birth||'DOB not recorded'}</small></td><td>{r.father_name||'—'}</td><td>{a?.admission_no||'—'}</td><td>{a?.session?.session_name||'—'}</td><td>{a?.class?.class_name||'—'}</td><td><span className={`adm-status ${a?.admission_status||'unknown'}`}>{(a?.admission_status||'Unknown').replace(/_/g,' ')}</span><button type="button" className="adm-download-btn" onClick={()=>void printAdmission(r.id)} title="Download / print single-page A4 admission form"><Printer size={14}/> A4 Form</button></td></tr>})}</tbody></table></div>}
    </div>
  </section>
}
