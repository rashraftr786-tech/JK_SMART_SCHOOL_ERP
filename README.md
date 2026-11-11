# JK SMART SCHOOLS ERP — Phase 1 Foundation

> **Important — existing live Supabase project:** This repository contains an earlier Phase 1 migration. It does not match the live schema verified for the current JK SMART SCHOOLS ERP deployment. **Do not run `supabase/migrations/0001_phase1_foundation.sql` against the existing live project.** Use the live database as the source of truth. See [PHASE1_USER_MANAGEMENT.md](PHASE1_USER_MANAGEMENT.md) for the current User Management implementation and deployment notes. No live database changes are performed by this package.

A secure, multi-school foundation built with React, TypeScript, Vite and Supabase.

## What is included

- React + TypeScript frontend and Supabase client configuration.
- Email/password sign-in and parent phone/password sign-in flow (phone provider configuration required).
- Password recovery request for email-based accounts.
- Role-aware dashboard and existing Super Admin zone/school screens.
- Super Admin-only User & Role Management directory and account creation form.
- Protected `admin-create-user` Edge Function source.
- Seven live role names represented in the frontend types.
- Responsive interface and environment-variable template.

This package is **User Management Phase 1 source code**, not a claim that the module is deployed or production-complete. The Edge Function must be deployed and tested. Student username provisioning, parent-child linking, account lifecycle controls, monitoring, automated backups and formal security testing remain later work.

## Technology

- React + TypeScript + Vite
- Supabase Auth + PostgreSQL + RLS
- Tailwind CSS
- Cloudflare Pages-ready static build

## 1. Create the Supabase project

1. Use the already configured Supabase project for this ERP.
2. Do not rerun the historical migration in this repository against that live project.
3. Open **Project Settings → API** and copy the Project URL and anon/publishable key.
4. Do not put the `service_role` key in this frontend project.

The historical migration file documents an earlier project schema and contains seed records for the initial school directory. It is retained for reference only and must not be applied to the confirmed live database.

## 2. Existing Super Administrator

The existing Super Administrator account and its role assignment must be retained. Do not create a replacement account or rerun the old bootstrap SQL. Public self-registration is disabled in the current frontend. Additional accounts are provisioned through the protected `admin-create-user` Edge Function after deployment and review.

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
| Email and phone sign-in UI | Included (phone provider required) |
| Public self-registration | Disabled |
| Seven live role types | Included |
| RLS foundation | Included |
| Super Admin zone registration | Included |
| Super Admin school registration | Included |
| Role-aware dashboard routing | Included |
| Profile foundation | Included |
| Audit log foundation | Included |
| User directory and account creation UI | Included (Super Admin only) |
| `admin-create-user` Edge Function source | Included; deployment pending |
| Student username authentication | Pending schema approval |
| Parent-child linking workflow | Pending |
| Account lifecycle controls | Pending |
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


## 8. User Management Phase 1

See [PHASE1_USER_MANAGEMENT.md](PHASE1_USER_MANAGEMENT.md) for the current account provisioning design, Edge Function deployment, supported account categories, and features intentionally held for the next phase. The service-role key belongs only in Supabase Edge Function server-side secrets.
