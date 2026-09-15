# MoveIn

MoveIn is a React and Vite relocation community app for exploring real experiences from people living in Lithuania.

## Local development

1. Copy `.env.example` to `.env.local` and add the Supabase URL and publishable key.
2. Install dependencies with `npm ci`.
3. Start the app with `npm run dev`.

The Supabase project must have the migration in [`supabase/migrations/20260913000000_create_contributions_and_storage.sql`](supabase/migrations/20260913000000_create_contributions_and_storage.sql) applied before using authentication, contributions, or media uploads. It creates the contributions table, the `community-media` bucket, and the related RLS policies.

The profile editor requires the follow-up migration [`supabase/migrations/20260913000001_create_profiles.sql`](supabase/migrations/20260913000001_create_profiles.sql). It creates the profiles table and policies that allow users to edit only their own profile.

Profile pictures require [`supabase/migrations/20260913000002_add_profile_avatars.sql`](supabase/migrations/20260913000002_add_profile_avatars.sql), which adds `avatar_url`, creates the `profile-avatars` bucket, and restricts uploads to each user’s own folder. The profile editor uses `react-easy-crop` to crop and zoom the image in the browser before uploading a square JPEG.

Admin access requires [`supabase/migrations/20260913000003_add_admin_role.sql`](supabase/migrations/20260913000003_add_admin_role.sql). After applying it, promote the first administrator manually in Supabase SQL Editor:

```sql
update public.profiles
set is_admin = true
where id = 'YOUR_AUTH_USER_UUID';
```

Do not expose admin promotion in the frontend. The database role and RLS policies are the authority for admin access.

Admins see an **Admin** navigation item after signing in. The dashboard lists profiles and contributions and supports admin post deletion. Regular users cannot render the admin view or use its protected database operations.

Apply [`supabase/migrations/20260913000004_sync_auth_users_to_profiles.sql`](supabase/migrations/20260913000004_sync_auth_users_to_profiles.sql) to keep authentication users and profiles synchronized. It backfills existing users and automatically creates a profile row when a new user signs up.

Moderation requires [`supabase/migrations/20260913000005_add_contribution_moderation.sql`](supabase/migrations/20260913000005_add_contribution_moderation.sql). Existing posts are marked `approved`; new posts are `pending` until an admin approves them. Authors can see their own pending posts, while public Explore shows approved posts only.

Post detail interactions require [`supabase/migrations/20260913000006_add_post_interactions.sql`](supabase/migrations/20260913000006_add_post_interactions.sql). It creates likes and comments tables with RLS. Users can favorite posts locally, but must be signed in to like or comment.

Comment notifications require [`supabase/migrations/20260913000007_add_comment_notifications.sql`](supabase/migrations/20260913000007_add_comment_notifications.sql). It creates notifications and a database trigger that alerts the post owner when another user comments.

Mentions require [`supabase/migrations/20260913000008_add_comment_mentions.sql`](supabase/migrations/20260913000008_add_comment_mentions.sql). Typing `@` in a comment shows profile suggestions, stores the selected user IDs, and sends mention notifications.

Apply [`supabase/migrations/20260913000009_improve_mention_notifications.sql`](supabase/migrations/20260913000009_improve_mention_notifications.sql) to update the notification text so admins receive messages such as “Someone tagged you in a comment on: ...”.

Apply [`supabase/migrations/20260915000010_add_contribution_decision_fields.sql`](supabase/migrations/20260915000010_add_contribution_decision_fields.sql) to store each contributor's optional monthly-budget range and “what I wish I knew” takeaway.

## Google login

The login modal includes Google OAuth through Supabase. To enable it:

1. Create a Web OAuth client in Google Cloud Console.
2. In Supabase, open **Authentication → Providers → Google** and enable Google.
3. Copy the Google client ID and client secret into the Supabase Google provider settings.
4. In Google Cloud, add this authorized redirect URI:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

5. In Supabase, open **Authentication → URL Configuration** and add the local and deployed app URLs to the redirect allow list:

```text
http://localhost:5173
https://YOUR_VERCEL_DOMAIN
```

The browser app uses the public Supabase key. Never put a Google client secret or Supabase service-role key in `.env.local`, Vercel frontend variables, or source code.

To apply migrations with the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

For local database testing, install and start Docker, then run `npx supabase start` before `npx supabase db reset`. If the CLI is not linked, run the migration SQL directly in the Supabase Dashboard SQL Editor.

## Validation

Run the same checks used by GitHub Actions:

```bash
npm run lint
npm run build
npm run test:e2e
```

The browser smoke test is stored in [`tests/onboarding.spec.js`](tests/onboarding.spec.js). It verifies that the Lithuania experience page opens the login modal from the in-app header. Playwright starts a temporary Vite server automatically when the test runs.

The authenticated CRUD test is stored in [`tests/authenticated-contribution.spec.js`](tests/authenticated-contribution.spec.js). It creates and deletes a test contribution, but runs only when a separate test Supabase project and test user are configured through `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_USER_EMAIL`, and `TEST_USER_PASSWORD`. Do not use production credentials for this test.

The CI workflow is stored in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and runs linting, the production build, and browser tests on pushes and pull requests targeting `main`.

## Project structure

- `src/App.jsx`: application state, authentication, contributions, and media uploads
- `src/App.css`: application styles
- `src/data/content.js`: seed content
- `src/lib/supabase.js`: Supabase client setup
- `supabase/migrations/`: versioned database and storage changes

## Original Vite notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
