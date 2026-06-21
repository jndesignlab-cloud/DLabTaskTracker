# DesignLab Daily Tracker

A minimalist task dashboard for DesignLab Creative Studio, built with HTML, CSS, JavaScript, Google Sheets, Google Apps Script, and GitHub Pages.

## Version

**v1.1.0**

## New in v1.1.0

- Simplified sidebar links:
  - Dashboard
  - Social Media Planner
  - Portfolio Viewer
  - Portfolio Admin
- Collapsible Previous Tasks archive
- Search and status filtering inside the archive
- Pending Work Queue showing incomplete tasks across all dates
- Floating refresh button
- Floating statistics dashboard
- All-time statistics, including completion rate, completed tasks, pending tasks, high-priority tasks, completed-this-week count, most active category, and average tasks per active day
- Footer versioning and ownership details
- Central `config.js` for the API URL and external links

## Files

- `index.html` — main interface
- `style.css` — DesignLab visual system
- `script.js` — frontend logic
- `config.js` — links, app details, version, and Apps Script URL
- `Code.gs` — Google Apps Script backend
- `README.md` — setup and project documentation

## Setup

### 1. Google Sheet

Create a sheet tab named `Tasks` with these headers:

```text
Task ID | Date | Time Slot | Task Name | Category | Urgency | Status | Remarks | Created At | Updated At | Completed At
```

### 2. Apps Script

Open **Extensions → Apps Script**, replace the code with `Code.gs`, then deploy it as a Web App.

Recommended deployment settings:

- Execute as: **Me**
- Who has access: **Anyone**

When updating the script later, edit the existing deployment and select **New version** so the Web App URL remains unchanged.

### 3. Configuration

Open `config.js` and replace:

```js
apiUrl: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE"
```

Also add the correct URLs for the Social Media Planner and Portfolio Admin.

### 4. GitHub Pages

Upload the frontend files to your GitHub repository:

- `index.html`
- `style.css`
- `script.js`
- `config.js`
- `README.md`

Then enable GitHub Pages using the `main` branch and `/root` folder.

## Statistics

The statistics drawer is calculated from all task records loaded from Google Sheets. Completion rate is:

```text
Completed Tasks ÷ Total Tasks × 100
```

## Notes

- Do not expose private credentials in `config.js`.
- The Apps Script Web App URL is expected to be publicly callable because the frontend runs on GitHub Pages.
- For a client-facing commercial version, consider adding authentication, per-user data separation, validation, backups, and a privacy notice.

## Credits

Developed for **DesignLab Creative Studio**.
