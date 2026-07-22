# Upgrade Notes: v1.1.0 → v2.1.0

## Recommended rollout

1. Keep the existing v1.1.0 deployment and Google Sheet untouched as a rollback copy.
2. Run `supabase-schema.sql` in the supplied Supabase project.
3. Create the single confirmed owner Auth user described in `README.md`.
4. Disable new user signups and anonymous sign-ins after creating the owner.
5. Deploy v2.1.0 to a temporary GitHub Pages folder or branch.
6. Sign in as `designlab` and test creating, editing, completing, and moving a sample task.
7. Open `migrate.html`, preview the Google Sheets records, and run the migration.
8. Compare task counts and spot-check completed, pending, dated, timed, and remarked tasks.
9. Replace the live deployment only after the checks pass.
10. Retain the old Apps Script endpoint briefly as a rollback source.

## Authentication change

- Anonymous browser sessions have been removed.
- The app now uses one permanent Supabase Email/Password owner account.
- The visible login accepts the username `designlab` and maps it to the configured internal Auth email.
- The password is sent directly to Supabase during sign-in and is never stored in the frontend files.
- Supabase persists the session in browser storage, so normal visits open the dashboard directly.
- Clearing site data or changing devices only requires signing in again; the database records remain available.
- A local sign-out control has been added to the sidebar account card.

## Main workflow changes

- The weekly view is the default workspace.
- Desktop tasks can be dragged from one day to another.
- Every task has previous-day, today, and next-day move buttons.
- The daily view includes a bulk **Move Open Tasks to Tomorrow** action.
- The open-work queue supports bulk selection and moving tasks to today or tomorrow.
- Weekly summaries remain unfiltered so totals describe the full week.
- Search and filters affect the board/list only.

## Data behavior

- Every task row belongs to the permanent Supabase owner user ID.
- Row Level Security requires an authenticated user and only allows access to rows matching `auth.uid()`.
- The frontend queries one week at a time plus a separate unfinished-task queue.
- Recent history is loaded only when the archive is opened.
- Realtime refreshes visible data after task changes.
- The legacy Google Sheets Task ID remains in `legacy_task_id` to prevent duplicate imports.

## Important migration note

Tasks previously imported under an anonymous Supabase user will not automatically appear under the new permanent owner. This does not affect records still in the legacy Google Sheet; run `migrate.html` while signed in as the permanent owner to import them into the correct account.

## Rollback

Restore the previous GitHub Pages files and continue using the existing Google Sheets/Apps Script backend. The migration utility does not delete or modify the old sheet.
