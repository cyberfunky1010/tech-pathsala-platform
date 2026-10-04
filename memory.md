# PathSala project memory

## Current state
- The repository started as an empty package shell at `/home/cyberfunky/tech-pathsala-platform`.
- The authoritative product brief is `/home/cyberfunky/Downloads/school_cs_platform_master_implementation_spec.md`.
- A responsive student dashboard is implemented at `/`, with simple navigation for Overview, Learn, Assignments, Tests, Results, Gallery, and Settings.
- The Learn navigation now opens a focused learning-material view with subject filters, search, progress indicators, featured lesson, empty state, and a lesson detail drawer.
- The first `/api/v1/learning-material` contract now validates query/create payloads, rejects client-provided school scope, and reports explicit configuration errors until Postgres is connected.
- Prisma ORM is now using the standard Prisma 6 CLI/runtime; the schema formats, validates, and generates a typed client. Learning Material reads/writes now use Prisma and Supabase server sessions, with role and school-scope enforcement.
- Public landing page, Supabase email/password login UI, `/dashboard` route, and session-aware middleware protection are now implemented. The root route is public; unauthenticated users are redirected away from `/dashboard` when Supabase is configured.
- The student Learn screen now fetches `/api/v1/learning-material` with credentials, maps real Prisma material into the UI, and shows explicit loading, API error, and empty states instead of treating static demo material as persisted content.
- A Prisma PostgreSQL schema covers identity, schools, enrollments, learning material, assignments, tests/attempts, galleries, and audit logs.

## Product decisions
- Follow “simple outside, structured inside”.
- Use Next.js App Router, React, TypeScript, Tailwind-compatible CSS, Prisma/PostgreSQL, Supabase Auth/Storage, and Zod.
- Keep the app as a modular monolith.
- Never trust school/student/role identifiers from the client; authorization belongs in backend services/routes.
- Students retain stable UUID identity; admission numbers belong to enrollment history.
- Global vs school content is represented with scope fields, not duplicated tables.

## Next implementation steps
1. Add authenticated API client and connect the learning-material view to API/database data.
2. Add School Admin learning-material CRUD and private file uploads through Supabase Storage.
3. Implement assignments, tests, galleries, analytics, notifications, and audit events.
4. Add Vitest and Playwright coverage, beginning with authorization and school isolation.

## Validation
- Run `npm run lint` for static checks.
- Run `npm run build` for production compilation.
