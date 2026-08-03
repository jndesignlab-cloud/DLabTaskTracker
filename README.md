# DesignLab Task Tracker — Owner Login Edition

**Version 2.2.0**

A personal DesignLab task workspace with Supabase storage, one permanent owner account, persistent browser sessions, daily and weekly views, quick rescheduling, weekly summaries, an open-work queue, and a Google Sheets migration utility.

## Login behavior

- Public username: `designlab`
- Supabase Auth email used internally: `designlab@madebydesignlab.com`
- The password is **not stored anywhere in the website files**.
- After the first successful sign-in, Supabase restores the session automatically on normal visits.
- The login screen returns only after signing out, clearing site data, using a new browser/device, or when the saved session is no longer valid.
- Signing in again restores the same Supabase tasks because they belong to the permanent owner account.

## 1. Run the database schema

1. Open the Supabase project.
2. Go to **SQL Editor**.
3. Run the full contents of `supabase-schema.sql`.

## 2. Create the single owner account

In Supabase Dashboard:

1. Open **Authentication → Users**.
2. Add a new user manually.
3. Use `designlab@madebydesignlab.com` as the email.
4. Use your chosen DesignLab password.
5. Mark or create the user as email-confirmed so it can sign in immediately.
6. Open **Authentication → Sign In / Providers**.
7. Keep Email/Password enabled.
8. Disable **Allow new users to sign up** after the owner account exists.
9. Disable **Allow anonymous sign-ins** because this version no longer uses anonymous users.

The website displays only the username `designlab`; the internal email is never requested from the user.

## 3. Frontend configuration

`config.js` is already configured with:

- The supplied Supabase project URL
- The supplied browser-safe publishable key
- Owner username `designlab`
- Internal owner Auth email `designlab@madebydesignlab.com`

Never place a `service_role`, secret, server key, or account password in `config.js` or any other frontend file.

## 4. Deploy to GitHub Pages

Upload these files to the repository root:

- `index.html`
- `style.css`
- `script.js`
- `config.js`
- `migrate.html`
- `migrate.js`
- `supabase-schema.sql`
- `README.md`
- `UPGRADE-NOTES.md`

## 5. Migrate the old Google Sheets tasks

1. Keep the old Apps Script web app online temporarily.
2. Sign in to the new tracker as `designlab`.
3. Open `migrate.html` on the same website and browser.
4. Preview the old records.
5. Click **Migrate Tasks**.
6. Verify the task count and spot-check dates, statuses, times, and remarks.
7. Retire the old Apps Script endpoint only after verification.

The importer stores the old Task ID in `legacy_task_id` and uses an upsert, so rerunning it updates matching records instead of duplicating them.

## Quality-of-life additions in v2.2.0

- One-click time presets for **6:00 AM**, **NOW**, **6:00 PM**, and clearing the time
- One-click task dates for **Today** and **Tomorrow**
- **Save & Add Another** keeps the chosen date, time, category, and urgency for fast batch entry
- The most recently used category and urgency are remembered on the current browser
- `Ctrl`/`Cmd` + `Enter` saves the open task form
- `Escape` closes task and queue dialogs
- Direct visits ending in `index.html` are cleaned to the folder/root URL without reloading

## Main tracker features

- Daily and weekly task modes
- Monday-to-Sunday weekly board
- Desktop drag-and-drop between dates
- Previous day, today, and next day task controls
- Bulk move unfinished daily tasks to tomorrow
- Open-work queue with multi-select transfers
- Weekly completion and workload summary
- Category and day breakdowns
- Overdue and priority indicators
- Duplicate, reopen, complete, edit, and delete actions
- Date-range Supabase loading
- Lazy-loaded task history
- Optional Realtime refreshes
- Row Level Security based on the authenticated owner ID

## Keyboard shortcuts

- `N` — add a task
- `D` — daily view
- `W` — weekly view
- `←` / `→` — previous or next period when not typing
- `Ctrl`/`Cmd` + `Enter` — save the open task form
- `Escape` — close the open dialog

## Recovery behavior

Clearing browsing history alone normally does not remove the session. Clearing cookies or site data does. When that happens, sign in again with the same owner credentials and the existing tasks return from Supabase.

## Clean URL behavior

Deploy the tracker with `index.html` at the repository or folder root and link to the folder URL ending in `/`. If someone opens a URL ending in `index.html`, the tracker removes that filename from the visible address bar using the History API. No server rewrite or database change is required.
