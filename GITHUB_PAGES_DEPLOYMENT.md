# GitHub Pages deployment repair

This repository is a Vite + React + TypeScript application. GitHub Pages must publish the generated `dist/` folder, not the repository's source files. The workflow at `.github/workflows/deploy.yml` builds the app and publishes `dist/` automatically.

## One-time GitHub settings

1. Push/replace the contents of this repaired project in the repository `rashraftr786-tech/JK_SMART_SCHOOL_ERP` on the `main` branch. Keep the repository name exactly `JK_SMART_SCHOOL_ERP` because `vite.config.ts` uses `/JK_SMART_SCHOOL_ERP/` as its base path.
2. Open **Repository → Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions** (not **Deploy from a branch**).
4. Open **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `VITE_SUPABASE_URL` — the Supabase Project URL.
   - `VITE_SUPABASE_ANON_KEY` — the Supabase anon/publishable key only.
5. Do not add a Supabase `service_role` key, database password, or other privileged secret to this frontend build.
6. Open the **Actions** tab and select **Build and deploy JK SMART SCHOOLS ERP**. The workflow should run automatically after the push. If it does not, select **Run workflow**.
7. Wait for both the `build` and `deploy` jobs to finish successfully, then open:
   `https://rashraftr786-tech.github.io/JK_SMART_SCHOOL_ERP/`

## Notes

- The source `index.html` correctly points to `src/main.tsx`; Vite rewrites/bundles that entry during `npm run build`. Do not publish the source directory directly.
- `vite.config.ts` already has the correct GitHub Pages base path. Do not change it unless the repository name changes.
- If the Supabase secrets are not configured, the site can still build, but the app will show its Supabase setup screen and authentication/database functions will not work until valid values are supplied.
- This deployment repair changes build and publishing only. It does not alter the Supabase schema, application data, authentication logic, or dashboard/database queries.
