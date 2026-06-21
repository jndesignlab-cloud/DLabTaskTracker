const CONFIG = window.DLAB_CONFIG || {};
const API_URL = CONFIG.apiUrl || "";

let selectedDateTasks = [];
let allTasks = [];
let editingTaskId = null;

const categoryOptions = ["PERSONAL", "PAGE", "BUSINESS", "WORK", "LEISURE"];
const urgencyOptions = ["Today’s Priority", "High Priority", "Weekly Task", "Daily Task", "Low Priority"];
const statusOptions = ["Pending", "In Progress", "Completed", "Cancelled"];

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
  applyConfig();
  setupCurrentDate();
  setupLiveClock();
  setupDropdowns();
  setupEventListeners();
  loadAllData();
}

function applyConfig() {
  document.title = CONFIG.appName || "DesignLab Daily Tracker";
  $("footerOwner").textContent = CONFIG.owner || "DesignLab Creative Studio";
  $("footerVersion").textContent = `Version ${CONFIG.version || "1.1.0"}`;
  const links = CONFIG.links || {};
  $("dashboardLink").href = links.dashboard || "./";
  setExternalLink("socialPlannerLink", links.socialMediaPlanner);
  setExternalLink("portfolioViewerLink", links.portfolioViewer);
  setExternalLink("portfolioAdminLink", links.portfolioAdmin);
}

function setExternalLink(id, url) {
  const el = $(id);
  if (!url || url.startsWith("PASTE_")) {
    el.href = "#";
    el.addEventListener("click", event => {
      event.preventDefault();
      showToast("Add this link in config.js first.", "error");
    });
    return;
  }
  el.href = url;
}

function setupCurrentDate() {
  const today = new Date();
  $("dateDisplay").textContent = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  $("dateFilter").value = formatDateForInput(today);
  $("taskDate").value = formatDateForInput(today);
}

function setupLiveClock() {
  const tick = () => $("timeDisplay").textContent = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  tick(); setInterval(tick, 1000);
}

function setupDropdowns() {
  populateSelect($("categoryFilter"), ["All Categories", ...categoryOptions]);
  populateSelect($("urgencyFilter"), ["All Urgencies", ...urgencyOptions]);
  populateSelect($("statusFilter"), ["All Status", ...statusOptions]);
  populateSelect($("taskCategory"), categoryOptions);
  populateSelect($("taskUrgency"), urgencyOptions);
  populateSelect($("taskStatus"), statusOptions);
}

function populateSelect(select, options) {
  select.innerHTML = "";
  options.forEach(value => select.add(new Option(value, value)));
}

function setupEventListeners() {
  $("addTaskBtn").addEventListener("click", openAddModal);
  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelTaskBtn").addEventListener("click", closeModal);
  $("taskForm").addEventListener("submit", handleTaskSubmit);
  ["searchInput", "categoryFilter", "urgencyFilter", "statusFilter"].forEach(id => $(id).addEventListener(id === "searchInput" ? "input" : "change", renderTasks));
  $("dateFilter").addEventListener("change", loadSelectedDateTasks);
  $("historySearchInput").addEventListener("input", renderTaskHistory);
  $("historyStatusFilter").addEventListener("change", renderTaskHistory);
  $("archiveToggle").addEventListener("click", toggleArchive);
  $("viewPendingBtn").addEventListener("click", showAllPendingQueue);
  $("refreshBtn").addEventListener("click", loadAllData);
  $("statsBtn").addEventListener("click", openStatsDrawer);
  $("closeStatsBtn").addEventListener("click", closeStatsDrawer);
  $("drawerBackdrop").addEventListener("click", closeStatsDrawer);
  window.addEventListener("click", event => { if (event.target === $("taskModal")) closeModal(); });
}

async function apiGet(params = {}) {
  ensureApiUrl();
  const response = await fetch(`${API_URL}?${new URLSearchParams(params)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function apiPost(payload = {}) {
  ensureApiUrl();
  const response = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function ensureApiUrl() {
  if (!API_URL || API_URL.startsWith("PASTE_")) throw new Error("Add your Apps Script URL in config.js.");
}

async function loadAllData() {
  showLoading(true);
  try {
    const result = await apiGet({ action: "getTasks" });
    if (!result.success) throw new Error(result.message || "Failed to load tasks.");
    allTasks = result.tasks || [];
    selectedDateTasks = allTasks.filter(task => task.date === $("dateFilter").value);
    renderEverything();
    $("lastRefreshed").textContent = `Last refreshed: ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    showToast("Dashboard refreshed.", "success");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not load tasks.", "error");
  } finally { showLoading(false); }
}

function loadSelectedDateTasks() {
  selectedDateTasks = allTasks.filter(task => task.date === $("dateFilter").value);
  renderDashboardStats();
  renderTasks();
}

function renderEverything() {
  renderDashboardStats();
  renderTasks();
  renderPendingAlert();
  renderTaskHistory();
  renderStats();
}

function renderDashboardStats() {
  const completed = selectedDateTasks.filter(t => t.status === "Completed").length;
  const pending = selectedDateTasks.filter(t => t.status === "Pending").length;
  const high = selectedDateTasks.filter(t => ["Today’s Priority", "High Priority"].includes(t.urgency) && t.status !== "Completed").length;
  $("todayTasksCount").textContent = selectedDateTasks.length;
  $("completedCount").textContent = completed;
  $("pendingCount").textContent = pending;
  $("highPriorityCount").textContent = high;
}

function getPendingTasks() {
  return allTasks.filter(task => ["Pending", "In Progress"].includes(task.status)).sort((a, b) => {
    const urgencyRank = { "Today’s Priority": 0, "High Priority": 1, "Daily Task": 2, "Weekly Task": 3, "Low Priority": 4 };
    return (urgencyRank[a.urgency] ?? 9) - (urgencyRank[b.urgency] ?? 9) || new Date(a.date) - new Date(b.date);
  });
}

function renderPendingAlert() {
  const pending = getPendingTasks();
  $("allPendingCount").textContent = pending.length;
  const preview = pending.slice(0, 3).map(t => t.taskName).join(" • ");
  $("pendingAlertText").textContent = pending.length ? `Next to work on: ${preview}${pending.length > 3 ? "…" : ""}` : "You have no pending tasks. Great work!";
  $("pendingAlert").classList.toggle("clear", pending.length === 0);
}

function showAllPendingQueue() {
  $("dateFilter").value = "";
  selectedDateTasks = getPendingTasks();
  $("statusFilter").value = "All Status";
  renderDashboardStats();
  renderTasks();
  $("todayTasksSection").scrollIntoView({ behavior: "smooth" });
  showToast("Showing pending tasks from all dates.", "success");
}

function renderTasks() {
  const body = $("taskTableBody");
  const filtered = getFilteredTasks();
  body.innerHTML = "";
  $("emptyState").style.display = filtered.length ? "none" : "block";
  filtered.forEach(task => {
    const row = document.createElement("tr");
    row.innerHTML = `<td><div class="task-name">${escapeHTML(task.taskName)}</div>${task.remarks ? `<div class="task-remarks">${escapeHTML(task.remarks)}</div>` : ""}</td><td>${escapeHTML(task.timeSlot || "—")}</td><td><span class="pill category-${slugify(task.category)}">${escapeHTML(task.category)}</span></td><td><span class="pill urgency-${slugify(task.urgency)}">${escapeHTML(task.urgency)}</span></td><td><span class="status status-${slugify(task.status)}">${escapeHTML(task.status)}</span></td><td><div class="action-buttons"><button class="icon-btn edit" onclick="openEditModal('${task.taskId}')" title="Edit">✎</button><button class="icon-btn delete" onclick="handleDeleteTask('${task.taskId}')" title="Delete">⌫</button><button class="icon-btn complete" onclick="handleCompleteTask('${task.taskId}')" title="Complete">✓</button></div></td>`;
    body.appendChild(row);
  });
}

function getFilteredTasks() {
  let filtered = [...selectedDateTasks];
  const term = $("searchInput").value.toLowerCase().trim();
  if (term) filtered = filtered.filter(t => [t.taskName, t.remarks, t.category, t.urgency, t.status].join(" ").toLowerCase().includes(term));
  if ($("categoryFilter").value !== "All Categories") filtered = filtered.filter(t => t.category === $("categoryFilter").value);
  if ($("urgencyFilter").value !== "All Urgencies") filtered = filtered.filter(t => t.urgency === $("urgencyFilter").value);
  if ($("statusFilter").value !== "All Status") filtered = filtered.filter(t => t.status === $("statusFilter").value);
  return filtered.sort((a, b) => convertTimeToMinutes(a.timeSlot) - convertTimeToMinutes(b.timeSlot));
}

function toggleArchive() {
  const content = $("archiveContent");
  const willOpen = content.hidden;
  content.hidden = !willOpen;
  $("archiveToggle").setAttribute("aria-expanded", String(willOpen));
  $("archiveChevron").textContent = willOpen ? "⌃" : "⌄";
}

function renderTaskHistory() {
  const body = $("historyTableBody");
  const term = $("historySearchInput").value.toLowerCase().trim();
  const status = $("historyStatusFilter").value;
  let history = [...allTasks].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (term) history = history.filter(t => [t.taskName, t.remarks, t.category, t.urgency, t.status, t.date].join(" ").toLowerCase().includes(term));
  if (status !== "All Status") history = history.filter(t => t.status === status);
  body.innerHTML = history.length ? "" : `<tr><td colspan="6" class="empty-history">No matching archived tasks.</td></tr>`;
  history.slice(0, 100).forEach(task => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${formatDateForDisplay(task.date)}</td><td>${escapeHTML(task.taskName)}</td><td><span class="pill category-${slugify(task.category)}">${escapeHTML(task.category)}</span></td><td><span class="pill urgency-${slugify(task.urgency)}">${escapeHTML(task.urgency)}</span></td><td><span class="status status-${slugify(task.status)}">${escapeHTML(task.status)}</span></td><td>${escapeHTML(task.completedAt || "—")}</td>`;
    body.appendChild(row);
  });
}

function renderStats() {
  const total = allTasks.length;
  const completed = allTasks.filter(t => t.status === "Completed").length;
  const pending = getPendingTasks().length;
  const high = allTasks.filter(t => ["Today’s Priority", "High Priority"].includes(t.urgency)).length;
  const rate = total ? Math.round((completed / total) * 100) : 0;
  const weekStart = new Date(); weekStart.setHours(0,0,0,0); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const completedWeek = allTasks.filter(t => t.status === "Completed" && t.completedAt && new Date(t.completedAt.replace(" ", "T")) >= weekStart).length;
  const categoryCounts = allTasks.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc; }, {});
  const topCategory = Object.entries(categoryCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || "—";
  const activeDays = new Set(allTasks.map(t => t.date).filter(Boolean)).size;
  $("statTotalTasks").textContent = total;
  $("statTotalCompleted").textContent = completed;
  $("statCurrentPending").textContent = pending;
  $("statHighPriority").textContent = high;
  $("statCompletionRate").textContent = `${rate}%`;
  $("statCompletedWeek").textContent = completedWeek;
  $("statTopCategory").textContent = topCategory;
  $("statDailyAverage").textContent = activeDays ? (total / activeDays).toFixed(1) : "0";
}

function openStatsDrawer() { $("statsDrawer").classList.add("open"); $("drawerBackdrop").classList.add("show"); $("statsDrawer").setAttribute("aria-hidden", "false"); }
function closeStatsDrawer() { $("statsDrawer").classList.remove("open"); $("drawerBackdrop").classList.remove("show"); $("statsDrawer").setAttribute("aria-hidden", "true"); }

function openAddModal() {
  editingTaskId = null; $("modalTitle").textContent = "Add New Task"; $("taskForm").reset();
  $("taskDate").value = $("dateFilter").value || formatDateForInput(new Date()); $("taskStatus").value = "Pending"; $("taskModal").classList.add("show");
}

function openEditModal(taskId) {
  const task = allTasks.find(t => t.taskId === taskId); if (!task) return showToast("Task not found.", "error");
  editingTaskId = taskId; $("modalTitle").textContent = "Edit Task"; $("taskDate").value = task.date; $("taskTime").value = to24Hour(task.timeSlot); $("taskName").value = task.taskName; $("taskCategory").value = task.category; $("taskUrgency").value = task.urgency; $("taskStatus").value = task.status; $("taskRemarks").value = task.remarks || ""; $("taskModal").classList.add("show");
}

function closeModal() { $("taskModal").classList.remove("show"); editingTaskId = null; }

async function handleTaskSubmit(event) {
  event.preventDefault();
  const payload = { date: $("taskDate").value, timeSlot: formatTimeFromInput($("taskTime").value), taskName: $("taskName").value.trim(), category: $("taskCategory").value, urgency: $("taskUrgency").value, status: $("taskStatus").value, remarks: $("taskRemarks").value.trim() };
  if (!payload.taskName) return showToast("Please enter a task name.", "error");
  try {
    const result = await apiPost({ action: editingTaskId ? "updateTask" : "addTask", ...(editingTaskId ? { taskId: editingTaskId } : {}), ...payload });
    if (!result.success) throw new Error(result.message || "Could not save task.");
    closeModal(); await loadAllData();
  } catch (error) { showToast(error.message, "error"); }
}

async function handleDeleteTask(taskId) {
  if (!confirm("Delete this task? This cannot be undone.")) return;
  try { const result = await apiPost({ action: "deleteTask", taskId }); if (!result.success) throw new Error(result.message); await loadAllData(); } catch (error) { showToast(error.message, "error"); }
}

async function handleCompleteTask(taskId) {
  try { const result = await apiPost({ action: "completeTask", taskId }); if (!result.success) throw new Error(result.message); await loadAllData(); } catch (error) { showToast(error.message, "error"); }
}

function formatDateForInput(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function formatDateForDisplay(value) { if (!value) return "—"; return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function formatTimeFromInput(value) { if (!value) return ""; const [h,m] = value.split(":").map(Number); const d = new Date(); d.setHours(h,m,0,0); return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
function to24Hour(value) { if (!value) return ""; const d = new Date(`2000-01-01 ${value}`); if (Number.isNaN(d.getTime())) return ""; return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
function convertTimeToMinutes(value) { const d = new Date(`2000-01-01 ${value}`); return Number.isNaN(d.getTime()) ? 99999 : d.getHours()*60+d.getMinutes(); }
function slugify(value) { return String(value || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function escapeHTML(value) { return String(value || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function showLoading(value) { $("loadingState").style.display = value ? "block" : "none"; }
function showToast(message, type="success") { let toast = $("toast"); if (!toast) { toast = document.createElement("div"); toast.id = "toast"; document.body.appendChild(toast); } toast.className = `toast ${type} show`; toast.textContent = message; clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800); }

window.openEditModal = openEditModal;
window.handleDeleteTask = handleDeleteTask;
window.handleCompleteTask = handleCompleteTask;
