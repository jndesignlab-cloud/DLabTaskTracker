const CONFIG = window.DLAB_CONFIG || {};
const $ = id => document.getElementById(id);

let client = null;
let currentUser = null;
let legacyTasks = [];

const validCategories = new Set(["PERSONAL", "PAGE", "BUSINESS", "WORK", "LEISURE"]);
const validUrgencies = new Set(["Today’s Priority", "High Priority", "Weekly Task", "Daily Task", "Low Priority"]);
const validStatuses = new Set(["Pending", "In Progress", "Completed", "Cancelled"]);

document.addEventListener("DOMContentLoaded", initializeMigration);

async function initializeMigration() {
  $("previewLegacyBtn").addEventListener("click", previewLegacyTasks);
  $("migrateTasksBtn").addEventListener("click", migrateTasks);

  try {
    validateConfiguration();
    client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const session = data.session;
    const expectedEmail = String(CONFIG.ownerAuthEmail || "").trim().toLowerCase();
    const signedInEmail = String(session?.user?.email || "").trim().toLowerCase();
    if (!session?.user || signedInEmail !== expectedEmail) {
      throw new Error("Sign in to the DesignLab Task Tracker first, then reopen this migration page.");
    }
    currentUser = session.user;
    $("migrationAccount").textContent = CONFIG.ownerUsername || "designlab";
    $("legacySourceStatus").textContent = CONFIG.legacyApiUrl ? "Configured" : "Missing URL";
  } catch (error) {
    $("migrationAccount").textContent = "Configuration error";
    $("legacySourceStatus").textContent = "Unavailable";
    $("previewLegacyBtn").disabled = true;
    showToast(error.message || "Could not initialize migration.", "error", 7000);
  }
}

function validateConfiguration() {
  if (!window.supabase) throw new Error("Supabase library failed to load.");
  if (!CONFIG.supabaseUrl || CONFIG.supabaseUrl.startsWith("PASTE_")) throw new Error("Add the Supabase URL in config.js.");
  if (!CONFIG.supabasePublishableKey || CONFIG.supabasePublishableKey.startsWith("PASTE_")) throw new Error("Add the Supabase publishable key in config.js.");
  if (!CONFIG.ownerAuthEmail) throw new Error("Add ownerAuthEmail in config.js.");
  if (!CONFIG.legacyApiUrl || CONFIG.legacyApiUrl.startsWith("PASTE_")) throw new Error("Add the old Apps Script URL as legacyApiUrl in config.js.");
}

async function previewLegacyTasks() {
  setPreviewBusy(true);
  try {
    const response = await fetch(`${CONFIG.legacyApiUrl}?${new URLSearchParams({ action: "getTasks" })}`);
    if (!response.ok) throw new Error(`Legacy endpoint returned HTTP ${response.status}.`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || "The legacy endpoint did not return tasks.");
    legacyTasks = Array.isArray(result.tasks) ? result.tasks : [];
    $("legacyTaskCount").textContent = legacyTasks.length;
    $("migrateTasksBtn").disabled = legacyTasks.length === 0 || !currentUser;
    renderPreview();
    showToast(`${legacyTasks.length} legacy task(s) loaded.`, "success");
  } catch (error) {
    showToast(error.message || "Could not read legacy tasks.", "error", 7000);
  } finally {
    setPreviewBusy(false);
  }
}

function renderPreview() {
  const preview = $("migrationPreview");
  if (!legacyTasks.length) {
    preview.innerHTML = `<div class="empty-state show"><div class="empty-icon">☁</div><h4>No legacy tasks found.</h4><p>Check the Apps Script deployment and the Tasks sheet.</p></div>`;
    return;
  }
  preview.innerHTML = legacyTasks.slice(0, 100).map(task => `
    <div class="migration-row">
      <span>${escapeHTML(task.date || "No date")}</span>
      <strong>${escapeHTML(task.taskName || "Untitled task")}</strong>
      <span>${escapeHTML(task.category || "WORK")}</span>
      <span>${escapeHTML(task.status || "Pending")}</span>
    </div>`).join("") + (legacyTasks.length > 100 ? `<div class="migration-row"><span>Preview</span><strong>${legacyTasks.length - 100} more task(s) will also be migrated.</strong><span></span><span></span></div>` : "");
}

async function migrateTasks() {
  if (!currentUser || !legacyTasks.length) return;
  if (!window.confirm(`Migrate ${legacyTasks.length} task(s) into the DesignLab owner account?`)) return;

  setMigrationBusy(true);
  let processed = 0;
  let imported = 0;
  const batchSize = 100;

  try {
    for (let index = 0; index < legacyTasks.length; index += batchSize) {
      const batch = legacyTasks.slice(index, index + batchSize).map(mapLegacyTask).filter(Boolean);
      if (batch.length) {
        const { data, error } = await client
          .from("tasks")
          .upsert(batch, { onConflict: "user_id,legacy_task_id" })
          .select("id");
        if (error) throw error;
        imported += data?.length || batch.length;
      }
      processed = Math.min(index + batchSize, legacyTasks.length);
      updateProgress(processed, legacyTasks.length);
    }

    $("migratedTaskCount").textContent = imported;
    $("migrationProgressText").textContent = `Migration complete. ${imported} task record(s) inserted or updated.`;
    showToast("Migration completed successfully.", "success", 6500);
  } catch (error) {
    $("migrationProgressText").textContent = `Migration stopped after ${processed} task(s).`;
    showToast(error.message || "Migration failed.", "error", 8000);
  } finally {
    setMigrationBusy(false);
  }
}

function mapLegacyTask(task) {
  const date = normalizeLegacyDate(task.date);
  if (!date || !task.taskName) return null;
  const status = validStatuses.has(task.status) ? task.status : "Pending";
  return {
    user_id: currentUser.id,
    legacy_task_id: task.taskId || `LEGACY-${date}-${String(task.taskName).slice(0, 80)}`,
    task_date: date,
    time_slot: parseLegacyTime(task.timeSlot),
    task_name: String(task.taskName).trim().slice(0, 180),
    category: validCategories.has(task.category) ? task.category : "WORK",
    urgency: validUrgencies.has(task.urgency) ? task.urgency : "Low Priority",
    status,
    remarks: String(task.remarks || "").slice(0, 2000),
    created_at: parseLegacyDateTime(task.createdAt) || new Date().toISOString(),
    updated_at: parseLegacyDateTime(task.updatedAt) || new Date().toISOString(),
    completed_at: status === "Completed" ? (parseLegacyDateTime(task.completedAt) || new Date().toISOString()) : null
  };
}

function normalizeLegacyDate(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseLegacyTime(value) {
  if (!value) return null;
  const text = String(value).trim();
  const twentyFourHour = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFourHour) return `${String(Number(twentyFourHour[1])).padStart(2, "0")}:${twentyFourHour[2]}:00`;
  const twelveHour = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!twelveHour) return null;
  let hour = Number(twelveHour[1]) % 12;
  if (twelveHour[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${twelveHour[2]}:00`;
}

function parseLegacyDateTime(value) {
  if (!value) return null;
  const normalized = String(value).includes("T") ? String(value) : String(value).replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function updateProgress(processed, total) {
  const percent = total ? Math.round((processed / total) * 100) : 0;
  $("migrationProgressBar").style.width = `${percent}%`;
  $("migrationProgressText").textContent = `Migrating ${processed} of ${total} task(s)…`;
  $("migratedTaskCount").textContent = processed;
}

function setPreviewBusy(isBusy) {
  $("previewLegacyBtn").disabled = isBusy;
  $("previewLegacyBtn").textContent = isBusy ? "Loading…" : "Preview Legacy Tasks";
}

function setMigrationBusy(isBusy) {
  $("migrationProgress").hidden = false;
  $("migrateTasksBtn").disabled = isBusy;
  $("previewLegacyBtn").disabled = isBusy;
  $("migrateTasksBtn").textContent = isBusy ? "Migrating…" : "Migrate Tasks";
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = "success", duration = 3200) {
  const toast = $("toast");
  toast.className = `toast ${type} show`;
  toast.textContent = message;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), duration);
}
