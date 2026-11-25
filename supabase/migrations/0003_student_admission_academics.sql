-- JK SMART SCHOOLS ERP: academic sessions and student admission foundation.
-- REVIEW BEFORE APPLYING: this migration creates NEW erp_* tables and a private
-- Storage bucket. It does not alter existing profiles, roles or memberships.

create extension if not exists pgcrypto;

create table if not exists public.erp_academic_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  session_name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint erp_session_dates_check check (end_date >= start_date),
  constraint erp_session_school_name_unique unique (school_id, session_name),
  constraint erp_session_id_school_unique unique (id, school_id)
);
create unique index if not exists erp_one_current_session_per_school
  on public.erp_academic_sessions(school_id) where is_current = true;

create table if not exists public.erp_school_classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint erp_class_school_name_unique unique (school_id, class_name),
  constraint erp_class_id_school_unique unique (id, school_id)
);

create table if not exists public.erp_school_sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  section_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint erp_section_class_school_fk foreign key (class_id, school_id)
    references public.erp_school_classes(id, school_id) on delete cascade,
  constraint erp_section_class_name_unique unique (class_id, section_name),
  constraint erp_section_id_school_unique unique (id, school_id)
);

create table if not exists public.erp_students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  first_name text not null,
  middle_name text,
  last_name text,
  aadhaar_name_first text,
  aadhaar_name_middle text,
  aadhaar_name_last text,
  father_name text,
  father_first_name text,
  father_middle_name text,
  father_last_name text,
  mother_name text,
  mother_first_name text,
  mother_middle_name text,
  mother_last_name text,
  guardian_name text,
  guardian_relationship text,
  father_education text,
  mother_education text,
  guardian_education text,
  email text,
  gender text,
  residence text,
  tehsil text,
  district text,
  father_phone text,
  mother_phone text,
  aadhaar_number text,
  date_of_birth date,
  dob_in_words text,
  bank_account_number text,
  bank_name text,
  bank_branch text,
  ifsc_code text,
  category text,
  blood_group text,
  ration_card_number text,
  ration_card_type text,
  pen_number text,
  student_status text not null default 'active'
    check (student_status in ('active','transferred','withdrawn','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erp_students_id_school_unique unique (id, school_id)
);
create index if not exists erp_students_school_name_idx
  on public.erp_students(school_id, first_name, last_name);

create table if not exists public.erp_student_admissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  academic_session_id uuid not null,
  class_id uuid not null,
  section_id uuid,
  admission_no text,
  admission_date date not null default current_date,
  parent_declaration_confirmed boolean not null default false,
  parent_declaration_confirmed_at timestamptz,
  admission_status text not null default 'submitted'
    check (admission_status in ('draft','submitted','under_review','provisionally_admitted','confirmed','rejected','withdrawn')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erp_admission_student_school_fk foreign key (student_id, school_id)
    references public.erp_students(id, school_id) on delete restrict,
  constraint erp_admission_session_school_fk foreign key (academic_session_id, school_id)
    references public.erp_academic_sessions(id, school_id) on delete restrict,
  constraint erp_admission_class_school_fk foreign key (class_id, school_id)
    references public.erp_school_classes(id, school_id) on delete restrict,
  constraint erp_admission_section_school_fk foreign key (section_id, school_id)
    references public.erp_school_sections(id, school_id) on delete restrict
);
create unique index if not exists erp_admission_no_per_school_session
  on public.erp_student_admissions(school_id, academic_session_id, admission_no)
  where admission_no is not null and admission_no <> '';
create index if not exists erp_admissions_school_session_idx
  on public.erp_student_admissions(school_id, academic_session_id, admission_status);

create table if not exists public.erp_student_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  admission_id uuid not null references public.erp_student_admissions(id) on delete cascade,
  document_type text not null check (document_type in ('student_photo','birth_certificate','residence_proof','aadhaar_card','ration_card_eticket','blood_group_report','bank_passbook','transfer_certificate','other')),
  document_label text not null,
  is_required boolean not null default false,
  storage_path text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','uploaded','verified','rejected','not_applicable')),
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erp_document_student_school_fk foreign key (student_id, school_id)
    references public.erp_students(id, school_id) on delete restrict,
  constraint erp_document_one_type_per_admission unique (admission_id, document_type),
  constraint erp_document_storage_status_check check (
    (verification_status in ('pending','not_applicable') and storage_path is null)
    or (verification_status in ('uploaded','verified','rejected') and storage_path is not null)
  )
);

create table if not exists public.erp_document_verification_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  document_id uuid not null references public.erp_student_documents(id) on delete cascade,
  previous_status text,
  new_status text not null check (new_status in ('uploaded','verified','rejected','pending','not_applicable')),
  remarks text,
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Shared access predicate: only Super Admin or an active School Admin membership.
create or replace function public.erp_can_manage_school(p_school_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.role_name = 'super_admin'
  ) or exists (
    select 1 from public.school_memberships sm
    join public.user_roles ur on ur.user_id = sm.user_id
    join public.roles r on r.id = ur.role_id
    where sm.user_id = auth.uid() and sm.school_id = p_school_id
      and sm.is_active = true and r.role_name = 'school_admin'
  );
$$;
revoke all on function public.erp_can_manage_school(uuid) from public;
grant execute on function public.erp_can_manage_school(uuid) to authenticated;

-- Parent/teacher access is intentionally not granted by this first admission migration.
do $$ declare t text; begin
  foreach t in array array['erp_academic_sessions','erp_school_classes','erp_school_sections','erp_students','erp_student_admissions','erp_student_documents','erp_document_verification_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists erp_school_select on public.%I', t);
    execute format('drop policy if exists erp_school_insert on public.%I', t);
    execute format('drop policy if exists erp_school_update on public.%I', t);
    execute format('drop policy if exists erp_school_delete on public.%I', t);
    execute format('create policy erp_school_select on public.%I for select to authenticated using (public.erp_can_manage_school(school_id))', t);
    execute format('create policy erp_school_insert on public.%I for insert to authenticated with check (public.erp_can_manage_school(school_id))', t);
    execute format('create policy erp_school_update on public.%I for update to authenticated using (public.erp_can_manage_school(school_id)) with check (public.erp_can_manage_school(school_id))', t);
    if t in ('erp_school_classes','erp_school_sections') then
      execute format('create policy erp_school_delete on public.%I for delete to authenticated using (public.erp_can_manage_school(school_id))', t);
    end if;
  end loop;
end $$;

grant select, insert, update, delete on public.erp_academic_sessions, public.erp_school_classes, public.erp_school_sections to authenticated;
grant select, insert, update on public.erp_students, public.erp_student_admissions, public.erp_student_documents, public.erp_document_verification_events to authenticated;

-- Private bucket: documents are never publicly readable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-admission-documents','student-admission-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false, file_size_limit=10485760,
  allowed_mime_types=array['application/pdf','image/jpeg','image/png'];

drop policy if exists erp_admission_docs_read on storage.objects;
drop policy if exists erp_admission_docs_insert on storage.objects;
drop policy if exists erp_admission_docs_update on storage.objects;
drop policy if exists erp_admission_docs_delete on storage.objects;
create policy erp_admission_docs_read on storage.objects for select to authenticated
using (bucket_id='student-admission-documents' and public.erp_can_manage_school((storage.foldername(name))[1]::uuid));
create policy erp_admission_docs_insert on storage.objects for insert to authenticated
with check (bucket_id='student-admission-documents' and public.erp_can_manage_school((storage.foldername(name))[1]::uuid));
create policy erp_admission_docs_update on storage.objects for update to authenticated
using (bucket_id='student-admission-documents' and public.erp_can_manage_school((storage.foldername(name))[1]::uuid))
with check (bucket_id='student-admission-documents' and public.erp_can_manage_school((storage.foldername(name))[1]::uuid));
create policy erp_admission_docs_delete on storage.objects for delete to authenticated
using (bucket_id='student-admission-documents' and public.erp_can_manage_school((storage.foldername(name))[1]::uuid));

comment on table public.erp_students is 'Student identity and admission-form information. Highly sensitive columns are school-admin-only under RLS.';
comment on table public.erp_student_documents is 'Private admission documents with independent verification status.';
comment on table public.erp_academic_sessions is 'School-specific academic sessions; historical enrolments remain preserved.';
