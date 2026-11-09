# JK SMART SCHOOLS ERP — Phase 1 Foundation

A secure, multi-school foundation built with React, TypeScript, Vite and Supabase.

## What is included

- Supabase PostgreSQL schema and Row Level Security (RLS).
- Zone and school records, including the first configured zone and school.
- User profile and scoped role foundation.
- Email/password sign-in and sign-out.
- Role-aware landing dashboard.
- Super Admin screens to register zones and schools.
- Audit log table and school-change audit trigger.
- Responsive interface and environment-variable template.

This is a **Phase 1 foundation**, not a claim that every Phase 1 workflow is production-complete. User invitations, password recovery UI, full user administration, monitoring, automated backups and formal security testing remain follow-up implementation items.

## Technology

- React + TypeScript + Vite
- Supabase Auth + PostgreSQL + RLS
- Tailwind CSS
- Cloudflare Pages-ready static build

## 1. Create the Supabase project

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run `supabase/migrations/0001_phase1_foundation.sql`.
4. Open **Project Settings → API** and copy the Project URL and anon/public key.
5. Do not put the `service_role` key in this frontend project.

The SQL migration creates:
- Zone Wagoora
- Government Primary School Pethgam Wagoora (UDISE `01022202207`)

The school's phone number is intentionally left blank pending confirmation during configuration.

## 2. Create the first Super Administrator

1. Run the app locally and create your own account using the sign-up form.
2. In Supabase **Authentication → Users**, copy the UUID of that account.
3. In SQL Editor, run the following statement after replacing the UUID:

```sql
insert into public.user_roles (user_id, role)
values ('YOUR-AUTH-USER-UUID', 'super_admin')
on conflict do nothing;
```

This is a one-time trusted bootstrap step. Never expose database credentials or service-role keys in browser code. Do not allow public self-registration to assign privileged roles.

## 3. Run locally

```bash
npm install
cp .env.example .env
```

Set these values in `.env`:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

Then:

```bash
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

## 4. Deploy to GitHub Pages

This repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml`. It builds the Vite app and publishes the generated `dist/` directory.

1. In GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Under **Settings → Secrets and variables → Actions**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository secrets. Use the Supabase anon/publishable key only; never use the service-role key.
3. Push to the `main` branch. The workflow builds and deploys automatically. Check the **Actions** tab for its status.
4. The site will be published at `https://rashraftr786-tech.github.io/JK_SMART_SCHOOL_ERP/`.

The Vite base path is already configured for this repository. Do not publish the repository source directory or the `src/` folder directly; GitHub Pages must publish the generated `dist/` artifact. See [GITHUB_PAGES_DEPLOYMENT.md](GITHUB_PAGES_DEPLOYMENT.md) for detailed steps.

## 5. Deploy to Cloudflare Pages (alternative)

- Push this folder to a private GitHub repository.
- In Cloudflare Pages, create a project connected to that repository.
- Build command: `npm run build`
- Build output directory: `dist`
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build environment variables.
- Configure the production and preview URLs in Supabase Auth → URL Configuration.

## 6. Security notes

- RLS is enabled on all application tables in this migration.
- Privileged roles are assigned only through trusted administrative provisioning.
- The frontend uses only the Supabase anon/publishable key; RLS is the security boundary.
- Keep student data out of public storage buckets. Private files and signed access policies will be added with the student module.
- Do not import real student or staff records until access policies, backup procedures, consent requirements and security tests have been reviewed.
- Configure Supabase Auth email confirmation and password policies before production.
- Keep the repository private if it contains any non-public school configuration. Never commit `.env`.

## 7. Phase 1 implementation status

| Item | Status in this starter |
|---|---|
| Multi-school relational foundation | Included |
| Zone Wagoora + first school seed | Included |
| Authentication sign-in/sign-up | Included |
| Scoped role model | Included |
| RLS foundation | Included |
| Super Admin zone registration | Included |
| Super Admin school registration | Included |
| Role-aware dashboard routing | Included |
| Profile foundation | Included |
| Audit log foundation | Included |
| Secure admin invitation workflow | Pending |
| Password reset flow and email templates | Pending |
| Full user/role administration UI | Pending |
| Zone Admin / School Admin operational dashboards | Foundation only |
| Backup/restore workflow | Pending |
| Full QA and production security review | Pending |

## Initial school record

- Name: Government Primary School Pethgam Wagoora
- Zone: Wagoora
- District: Baramulla
- UT: Jammu and Kashmir
- UDISE: 01022202207
- Email: pspethgam@gmail.com
- Address: Wagoora Babareshi Road, Near Zonal Education Office Wagoora District Baramulla

## Important next step

After creating the Supabase project, provide the **Project URL** and the **anon/publishable key only** (never the service-role key or database password). These are intended for browser use when RLS is correctly configured. I can then help configure, test and deploy the foundation.
