const CONFIG = window.DLAB_CONFIG || {};
const categoryOptions = ["PERSONAL", "PAGE", "BUSINESS", "WORK", "LEISURE"];
const urgencyOptions = ["Today’s Priority", "High Priority", "Weekly Task", "Daily Task", "Low Priority"];
const statusOptions = ["Pending", "In Progress", "Completed", "Cancelled"];
const openStatuses = ["Pending", "In Progress"];

const state = {
  client: null,
  session: null,
  user: null,
  view: CONFIG.defaultView === "daily" ? "daily" : "weekly",
  focusDate: formatDateForInput(new Date()),
  weekTasks: [],
  openTasks: [],
  historyTasks: [],
  archiveLoaded: false,
  editingTaskId: null,
  realtimeChannel: null,
  refreshTimer: null,
  isLoading: false,
  reloadRequested: false
};

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  applyConfig();
  setupDropdowns();
  setupEventListeners();
  setupClock();
  setupFocusDate();

  try {
    validateSupabaseConfig();
    state.client = window.supabase.createClient(
      CONFIG.supabaseUrl,
      CONFIG.supabasePublishableKey,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );

    state.client.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => applySession(nextSession), 0);
    });

    const { data, error } = await state.client.auth.getSession();
    if (error) throw error;
    await applySession(data.session);
  } catch (error) {
    console.error(error);
    showLogin(error.message || "Could not initialize Supabase.");
    setSessionIndicator("Connection unavailable", "Check Supabase configuration", false);
    $("syncStatus").textContent = "Supabase: connection error";
  }
}

async function handleLogin(event) {
  event.preventDefault();
  if (!state.client) return setLoginMessage("Supabase is not ready. Check the project configuration.");

  const username = $("loginUsername").value.trim().toLowerCase();
  const password = $("loginPassword").value;
  const expectedUsername = String(CONFIG.ownerUsername || "").trim().toLowerCase();

  if (!username || !password) return setLoginMessage("Enter the username and password.");
  if (username !== expectedUsername) return setLoginMessage("Incorrect username or password.");

  setLoginBusy(true);
  setLoginMessage("");
  try {
    const { data, error } = await state.client.auth.signInWithPassword({
      email: CONFIG.ownerAuthEmail,
      password
    });
    if (error || !data.session) throw error || new Error("Supabase did not return a session.");
    await applySession(data.session);
    $("loginPassword").value = "";
  } catch (error) {
    console.error(error);
    setLoginMessage("Incorrect username or password.");
  } finally {
    setLoginBusy(false);
  }
}

async function signOutOwner() {
  if (!state.client) return;
  if (!window.confirm("Sign out of the DesignLab Task Tracker on this browser?")) return;
  try {
    const { error } = await state.client.auth.signOut({ scope: "local" });
    if (error) throw error;
    showLogin();
  } catch (error) {
    showToast(error.message || "Could not sign out.", "error");
  }
}

function togglePasswordVisibility() {
  const input = $("loginPassword");
  const shouldShow = input.type === "password";
  input.type = shouldShow ? "text" : "password";
  $("togglePasswordBtn").textContent = shouldShow ? "Hide" : "Show";
  $("togglePasswordBtn").setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
}

function setLoginBusy(isBusy) {
  $("loginBtn").disabled = isBusy;
  $("loginUsername").disabled = isBusy;
  $("loginPassword").disabled = isBusy;
  $("togglePasswordBtn").disabled = isBusy;
  $("loginBtn").textContent = isBusy ? "Signing In…" : "Sign In";
}

function setLoginMessage(message) {
  $("loginMessage").textContent = message || "";
}

function showLogin(message = "") {
  state.session = null;
  state.user = null;
  state.weekTasks = [];
  state.openTasks = [];
  state.historyTasks = [];
  state.archiveLoaded = false;
  teardownRealtime();
  setInterfaceReady(false);
  document.body.classList.remove("authenticated", "auth-loading");
  document.body.classList.add("auth-required");
  setSessionIndicator("Signed out", "Owner access required", false);
  $("syncStatus").textContent = "Supabase: signed out";
  setLoginMessage(message);
  $("loginUsername").value = CONFIG.ownerUsername || "designlab";
  window.setTimeout(() => $("loginPassword").focus(), 50);
}

function validateSupabaseConfig() {
  if (!window.supabase) throw new Error("Supabase library failed to load. Check your internet connection.");
  if (!CONFIG.supabaseUrl || CONFIG.supabaseUrl.startsWith("PASTE_")) {
    throw new Error("Add your Supabase project URL in config.js.");
  }
  if (!CONFIG.supabasePublishableKey || CONFIG.supabasePublishableKey.startsWith("PASTE_")) {
    throw new Error("Add your Supabase publishable key in config.js.");
  }
  if (!CONFIG.ownerUsername || !CONFIG.ownerAuthEmail) {
    throw new Error("Add the owner username and internal Auth email in config.js.");
  }
}

function applyConfig() {
  document.title = CONFIG.appName || "DesignLab Task Tracker";
  $("footerOwner").textContent = CONFIG.owner || "DesignLab Creative Studio";
  $("footerVersion").textContent = `Version ${CONFIG.version || "2.1.0"}`;

  const links = CONFIG.links || {};
  $("dashboardLink").href = links.dashboard || "./";
  setExternalLink("socialPlannerLink", links.socialMediaPlanner);
  setExternalLink("portfolioViewerLink", links.portfolioViewer);
  setExternalLink("portfolioAdminLink", links.portfolioAdmin);
}

function setExternalLink(id, url) {
  const element = $(id);
  if (!url || url.startsWith("PASTE_")) {
    element.href = "#";
    element.addEventListener("click", event => {
      event.preventDefault();
      showToast("Add this link in config.js first.", "error");
    });
    return;
  }
  element.href = url;
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

function setupFocusDate() {
  $("focusDateInput").value = state.focusDate;
  $("taskDate").value = state.focusDate;
}

function setupClock() {
  const tick = () => {
    const now = new Date();
    $("syncStatus").title = now.toLocaleString("en-US");
  };
  tick();
  window.setInterval(tick, 60000);
}

function setupEventListeners() {
  $("loginForm").addEventListener("submit", handleLogin);
  $("togglePasswordBtn").addEventListener("click", togglePasswordVisibility);
  $("signOutBtn").addEventListener("click", signOutOwner);
  $("dailyViewBtn").addEventListener("click", () => setView("daily"));
  $("weeklyViewBtn").addEventListener("click", () => setView("weekly"));
  $("previousPeriodBtn").addEventListener("click", () => movePeriod(-1));
  $("nextPeriodBtn").addEventListener("click", () => movePeriod(1));
  $("todayBtn").addEventListener("click", goToToday);
  $("focusDateInput").addEventListener("change", event => setFocusDate(event.target.value));

  $("addTaskBtn").addEventListener("click", () => openAddModal(state.focusDate));
  $("quickAddBtn").addEventListener("click", () => openAddModal(state.focusDate));
  $("closeModalBtn").addEventListener("click", closeTaskModal);
  $("cancelTaskBtn").addEventListener("click", closeTaskModal);
  $("taskForm").addEventListener("submit", handleTaskSubmit);

  ["searchInput", "categoryFilter", "urgencyFilter", "statusFilter"].forEach(id => {
    $(id).addEventListener(id === "searchInput" ? "input" : "change", renderAllViews);
  });
  $("clearFiltersBtn").addEventListener("click", clearFilters);
  $("refreshBtn").addEventListener("click", () => loadDashboard({ notify: true }));
  $("moveOpenToTomorrowBtn").addEventListener("click", moveCurrentDayOpenTasksToTomorrow);

  $("viewPendingBtn").addEventListener("click", openQueueModal);
  $("closeQueueBtn").addEventListener("click", closeQueueModal);
  $("selectAllQueueBtn").addEventListener("click", toggleSelectAllQueue);
  $("moveSelectedTodayBtn").addEventListener("click", () => moveSelectedQueueTasks(formatDateForInput(new Date())));
  $("moveSelectedTomorrowBtn").addEventListener("click", () => moveSelectedQueueTasks(addDays(formatDateForInput(new Date()), 1)));

  $("archiveToggle").addEventListener("click", toggleArchive);
  $("historySearchInput").addEventListener("input", renderTaskHistory);
  $("historyStatusFilter").addEventListener("change", renderTaskHistory);

  window.addEventListener("click", event => {
    if (event.target === $("taskModal")) closeTaskModal();
    if (event.target === $("queueModal")) closeQueueModal();
  });

  window.addEventListener("keydown", event => {
    if (!state.user || isTypingTarget(event.target)) return;
    if (event.key.toLowerCase() === "n") openAddModal(state.focusDate);
    if (event.key.toLowerCase() === "d") setView("daily");
    if (event.key.toLowerCase() === "w") setView("weekly");
    if (event.key === "ArrowLeft") movePeriod(-1);
    if (event.key === "ArrowRight") movePeriod(1);
  });
}

function isTypingTarget(target) {
  return target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

async function applySession(session) {
  if (!session?.user) return showLogin();

  const expectedEmail = String(CONFIG.ownerAuthEmail || "").trim().toLowerCase();
  const signedInEmail = String(session.user.email || "").trim().toLowerCase();
  if (signedInEmail !== expectedEmail) {
    await state.client.auth.signOut({ scope: "local" });
    return showLogin("This account is not authorized for the DesignLab workspace.");
  }

  const changedUser = state.user?.id !== session.user.id;
  state.session = session;
  state.user = session.user;

  document.body.classList.remove("auth-required", "auth-loading");
  document.body.classList.add("authenticated");
  setLoginMessage("");
  setSessionIndicator(CONFIG.ownerUsername || "designlab", "Owner account • session saved", true);
  setInterfaceReady(true);

  if (changedUser) {
    state.archiveLoaded = false;
    state.historyTasks = [];
    setView(state.view);
    setupRealtime();
    await loadDashboard();
  }
}

function setSessionIndicator(label, meta, isConnected) {
  $("sessionLabel").textContent = label;
  $("sessionMeta").textContent = meta;
  $("sessionDot").classList.toggle("connected", Boolean(isConnected));
}

function setInterfaceReady(isReady) {
  document.body.classList.toggle("session-pending", !isReady);
  $("appShell").setAttribute("aria-busy", String(!isReady));
}

function setView(view) {
  if (!state.user || !["daily", "weekly"].includes(view)) return;
  state.view = view;
  $("dailyViewBtn").classList.toggle("active", view === "daily");
  $("weeklyViewBtn").classList.toggle("active", view === "weekly");
  $("dailyView").hidden = view !== "daily";
  $("weeklyView").hidden = view !== "weekly";
  $("todayBtn").textContent = view === "daily" ? "Today" : "This Week";
  updatePeriodHeading();
  renderStats();
}

function movePeriod(direction) {
  const amount = state.view === "daily" ? direction : direction * 7;
  setFocusDate(addDays(state.focusDate, amount));
}

function goToToday() {
  setFocusDate(formatDateForInput(new Date()));
}

async function setFocusDate(date) {
  if (!date) return;
  state.focusDate = date;
  $("focusDateInput").value = date;
  await loadDashboard();
}

function getCurrentWeekRange() {
  const start = getWeekStart(state.focusDate);
  return { start, end: addDays(start, 6) };
}

function getWeekStart(dateString) {
  const date = parseDate(dateString);
  const requestedStart = Number(CONFIG.weekStartsOn) === 0 ? 0 : 1;
  const day = date.getDay();
  const difference = requestedStart === 1 ? (day === 0 ? -6 : 1 - day) : -day;
  date.setDate(date.getDate() + difference);
  return formatDateForInput(date);
}

async function loadDashboard({ notify = false } = {}) {
  if (!state.client || !state.user) return;
  if (state.isLoading) {
    state.reloadRequested = true;
    return;
  }
  state.isLoading = true;
  setSyncStatus("syncing");

  const { start, end } = getCurrentWeekRange();
  try {
    const [weekResult, openResult] = await Promise.all([
      state.client
        .from("tasks")
        .select("id,user_id,legacy_task_id,task_date,time_slot,task_name,category,urgency,status,remarks,sort_order,created_at,updated_at,completed_at")
        .gte("task_date", start)
        .lte("task_date", end)
        .order("task_date", { ascending: true })
        .order("time_slot", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true }),
      state.client
        .from("tasks")
        .select("id,user_id,task_date,time_slot,task_name,category,urgency,status,remarks,sort_order,created_at,updated_at,completed_at")
        .in("status", openStatuses)
        .order("task_date", { ascending: true })
        .order("time_slot", { ascending: true, nullsFirst: false })
        .limit(500)
    ]);

    if (weekResult.error) throw weekResult.error;
    if (openResult.error) throw openResult.error;

    state.weekTasks = (weekResult.data || []).map(normalizeTask);
    state.openTasks = (openResult.data || []).map(normalizeTask);
    renderAllViews();
    updatePeriodHeading();
    if (!$("archiveContent").hidden && !state.archiveLoaded) loadTaskHistory();
    $("lastRefreshed").textContent = `Last refreshed: ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    setSyncStatus("connected");
    if (notify) showToast("Dashboard refreshed.", "success");
  } catch (error) {
    console.error(error);
    setSyncStatus("error");
    showToast(error.message || "Could not load tasks.", "error", 6500);
  } finally {
    state.isLoading = false;
    if (state.reloadRequested) {
      state.reloadRequested = false;
      loadDashboard({ notify });
    }
  }
}

function normalizeTask(row) {
  return {
    id: row.id,
    userId: row.user_id,
    legacyTaskId: row.legacy_task_id || "",
    date: row.task_date,
    time: normalizeTime(row.time_slot),
    taskName: row.task_name,
    category: row.category,
    urgency: row.urgency,
    status: row.status,
    remarks: row.remarks || "",
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  };
}

function normalizeTime(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function renderAllViews() {
  renderWeeklyBoard();
  renderDailyView();
  renderStats();
  renderPendingAlert();
  renderWeeklySummary();
  if (!$("queueModal").classList.contains("show")) return;
  renderQueue();
}

function getFilteredTasks(tasks) {
  let filtered = [...tasks];
  const term = $("searchInput").value.toLowerCase().trim();
  const category = $("categoryFilter").value;
  const urgency = $("urgencyFilter").value;
  const status = $("statusFilter").value;

  if (term) {
    filtered = filtered.filter(task => [task.taskName, task.remarks, task.category, task.urgency, task.status]
      .join(" ").toLowerCase().includes(term));
  }
  if (category !== "All Categories") filtered = filtered.filter(task => task.category === category);
  if (urgency !== "All Urgencies") filtered = filtered.filter(task => task.urgency === urgency);
  if (status !== "All Status") filtered = filtered.filter(task => task.status === status);

  return filtered.sort(compareTasks);
}

function compareTasks(a, b) {
  const timeA = a.time || "99:99";
  const timeB = b.time || "99:99";
  return a.date.localeCompare(b.date) || timeA.localeCompare(timeB) || a.sortOrder - b.sortOrder || a.taskName.localeCompare(b.taskName);
}

function clearFilters() {
  $("searchInput").value = "";
  $("categoryFilter").value = "All Categories";
  $("urgencyFilter").value = "All Urgencies";
  $("statusFilter").value = "All Status";
  renderAllViews();
}

function renderWeeklyBoard() {
  const board = $("weekBoard");
  const { start } = getCurrentWeekRange();
  const filtered = getFilteredTasks(state.weekTasks);
  const today = formatDateForInput(new Date());
  board.innerHTML = "";

  for (let index = 0; index < 7; index += 1) {
    const date = addDays(start, index);
    const tasks = filtered.filter(task => task.date === date);
    const column = document.createElement("article");
    column.className = `day-column${date === today ? " today" : ""}`;
    column.dataset.date = date;
    column.innerHTML = `
      <div class="day-header">
        <div><p>${formatWeekday(date)}</p><h3>${formatMonthDay(date)}</h3></div>
        <span class="day-count">${tasks.length}</span>
      </div>
      <div class="day-task-stack"></div>
      <button class="day-add-btn" type="button" data-add-date="${date}">+ Add task</button>`;

    const stack = column.querySelector(".day-task-stack");
    if (!tasks.length) {
      stack.innerHTML = `<div class="day-empty">Drop a task here or add a new one.</div>`;
    } else {
      tasks.forEach(task => stack.appendChild(buildTaskCard(task)));
    }

    setupDropTarget(column);
    board.appendChild(column);
  }

  board.querySelectorAll("[data-add-date]").forEach(button => {
    button.addEventListener("click", () => openAddModal(button.dataset.addDate));
  });
}

function buildTaskCard(task) {
  const card = document.createElement("article");
  const overdue = isTaskOverdue(task);
  card.className = `task-card${task.status === "Completed" ? " completed" : ""}${overdue ? " overdue" : ""}`;
  card.draggable = true;
  card.dataset.taskId = task.id;
  card.innerHTML = `
    <div class="task-card-top">
      <span class="task-time">${escapeHTML(formatTimeDisplay(task.time) || "No time")}</span>
      <span class="status status-${slugify(task.status)}">${escapeHTML(task.status)}</span>
    </div>
    <h4>${escapeHTML(task.taskName)}</h4>
    ${task.remarks ? `<p>${escapeHTML(task.remarks)}</p>` : ""}
    <div class="task-meta">
      <span class="pill category-${slugify(task.category)}">${escapeHTML(task.category)}</span>
      <span class="pill urgency-${slugify(task.urgency)}">${escapeHTML(task.urgency)}</span>
      ${overdue ? '<span class="pill urgency-high-priority">Overdue</span>' : ""}
    </div>
    ${buildActionButtons(task)}`;

  card.addEventListener("dragstart", event => {
    card.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));
  wireTaskActions(card, task.id);
  return card;
}

function buildActionButtons(task) {
  const completeTitle = task.status === "Completed" ? "Reopen task" : "Mark completed";
  const completeIcon = task.status === "Completed" ? "↺" : "✓";
  return `<div class="task-actions">
    <button class="icon-btn" type="button" data-action="previous" title="Move one day earlier">←</button>
    <button class="icon-btn" type="button" data-action="today" title="Move to today">⌂</button>
    <button class="icon-btn" type="button" data-action="next" title="Move one day later">→</button>
    <button class="icon-btn" type="button" data-action="edit" title="Edit task">✎</button>
    <button class="icon-btn" type="button" data-action="duplicate" title="Duplicate task">⧉</button>
    <button class="icon-btn success" type="button" data-action="complete" title="${completeTitle}">${completeIcon}</button>
    <button class="icon-btn danger" type="button" data-action="delete" title="Delete task">⌫</button>
  </div>`;
}

function wireTaskActions(container, taskId) {
  container.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const action = button.dataset.action;
      if (action === "previous") moveTaskByDays(taskId, -1);
      if (action === "today") moveTaskToDate(taskId, formatDateForInput(new Date()));
      if (action === "next") moveTaskByDays(taskId, 1);
      if (action === "edit") openEditModal(taskId);
      if (action === "duplicate") duplicateTask(taskId);
      if (action === "complete") toggleTaskCompleted(taskId);
      if (action === "delete") deleteTask(taskId);
    });
  });
}

function setupDropTarget(column) {
  column.addEventListener("dragover", event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    column.classList.add("drag-over");
  });
  column.addEventListener("dragleave", event => {
    if (!column.contains(event.relatedTarget)) column.classList.remove("drag-over");
  });
  column.addEventListener("drop", event => {
    event.preventDefault();
    column.classList.remove("drag-over");
    const taskId = event.dataTransfer.getData("text/plain");
    if (taskId) moveTaskToDate(taskId, column.dataset.date);
  });
}

function renderDailyView() {
  const list = $("dailyTaskList");
  const tasks = getFilteredTasks(state.weekTasks.filter(task => task.date === state.focusDate));
  $("dailyPanelTitle").textContent = formatLongDate(state.focusDate);
  list.innerHTML = "";
  $("dailyEmptyState").classList.toggle("show", tasks.length === 0);

  tasks.forEach(task => {
    const item = document.createElement("article");
    const overdue = isTaskOverdue(task);
    item.className = `daily-task${task.status === "Completed" ? " completed" : ""}${overdue ? " overdue" : ""}`;
    item.innerHTML = `
      <div class="daily-task-time">${escapeHTML(formatTimeDisplay(task.time) || "No time")}</div>
      <div class="daily-task-main"><h4>${escapeHTML(task.taskName)}</h4>${task.remarks ? `<p>${escapeHTML(task.remarks)}</p>` : ""}</div>
      <div class="task-meta">
        <span class="pill category-${slugify(task.category)}">${escapeHTML(task.category)}</span>
        <span class="status status-${slugify(task.status)}">${escapeHTML(task.status)}</span>
        ${overdue ? '<span class="pill urgency-high-priority">Overdue</span>' : ""}
      </div>
      ${buildActionButtons(task)}`;
    wireTaskActions(item, task.id);
    list.appendChild(item);
  });
}

function renderStats() {
  const visibleTasks = state.view === "daily"
    ? state.weekTasks.filter(task => task.date === state.focusDate)
    : state.weekTasks;
  const completed = visibleTasks.filter(task => task.status === "Completed").length;
  const open = visibleTasks.filter(task => openStatuses.includes(task.status)).length;
  const attention = visibleTasks.filter(task => openStatuses.includes(task.status) && (
    isTaskOverdue(task) || ["Today’s Priority", "High Priority"].includes(task.urgency)
  )).length;

  $("periodTasksCount").textContent = visibleTasks.length;
  $("completedCount").textContent = completed;
  $("pendingCount").textContent = open;
  $("attentionCount").textContent = attention;
  $("totalStatLabel").textContent = state.view === "daily" ? "Selected Day" : "This Week";
  $("completedStatText").textContent = state.view === "daily" ? "For selected day" : "Within week";
}

function renderPendingAlert() {
  const pending = [...state.openTasks].sort(compareOpenTasks);
  $("allPendingCount").textContent = pending.length;
  const preview = pending.slice(0, 3).map(task => task.taskName).join(" • ");
  $("pendingAlertText").textContent = pending.length
    ? `Next up: ${preview}${pending.length > 3 ? "…" : ""}`
    : "You have no unfinished tasks. Great work!";
  $("pendingAlert").classList.toggle("clear", pending.length === 0);
}

function compareOpenTasks(a, b) {
  const urgencyRank = { "Today’s Priority": 0, "High Priority": 1, "Daily Task": 2, "Weekly Task": 3, "Low Priority": 4 };
  return Number(isTaskOverdue(b)) - Number(isTaskOverdue(a))
    || (urgencyRank[a.urgency] ?? 9) - (urgencyRank[b.urgency] ?? 9)
    || compareTasks(a, b);
}

function renderWeeklySummary() {
  const tasks = state.weekTasks;
  const completed = tasks.filter(task => task.status === "Completed").length;
  const inProgress = tasks.filter(task => task.status === "In Progress").length;
  const pending = tasks.filter(task => task.status === "Pending").length;
  const overdue = tasks.filter(isTaskOverdue).length;
  const rate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  $("weeklyCompletionRate").textContent = `${rate}%`;
  $("weeklyProgressBar").style.width = `${rate}%`;
  $("summaryCompleted").textContent = completed;
  $("summaryInProgress").textContent = inProgress;
  $("summaryPending").textContent = pending;
  $("summaryOverdue").textContent = overdue;

  const { start } = getCurrentWeekRange();
  const dayData = Array.from({ length: 7 }, (_value, index) => {
    const date = addDays(start, index);
    return [formatWeekdayShort(date), tasks.filter(task => task.date === date).length];
  });
  renderBreakdown($("dayBreakdown"), dayData);

  const categoryData = categoryOptions
    .map(category => [titleCase(category), tasks.filter(task => task.category === category).length])
    .filter(([, count]) => count > 0);
  renderBreakdown($("categoryBreakdown"), categoryData.length ? categoryData : [["No tasks", 0]]);
}

function renderBreakdown(container, entries) {
  const max = Math.max(...entries.map(([, count]) => count), 1);
  container.innerHTML = entries.map(([label, count]) => `
    <div class="breakdown-row">
      <span>${escapeHTML(label)}</span>
      <div class="breakdown-bar"><span style="width:${Math.round((count / max) * 100)}%"></span></div>
      <strong class="breakdown-value">${count}</strong>
    </div>`).join("");
}

function updatePeriodHeading() {
  const { start, end } = getCurrentWeekRange();
  if (state.view === "daily") {
    $("periodEyebrow").textContent = "Daily View";
    $("periodTitle").textContent = formatLongDate(state.focusDate);
  } else {
    $("periodEyebrow").textContent = "Weekly View";
    $("periodTitle").textContent = formatWeekRange(start, end);
  }
}

function openAddModal(date) {
  if (!state.user) return;
  state.editingTaskId = null;
  $("modalTitle").textContent = "Add New Task";
  $("taskForm").reset();
  $("taskDate").value = date || state.focusDate;
  $("taskCategory").value = "WORK";
  $("taskUrgency").value = "Low Priority";
  $("taskStatus").value = "Pending";
  openModal($("taskModal"));
  window.setTimeout(() => $("taskName").focus(), 40);
}

function openEditModal(taskId) {
  const task = findTask(taskId);
  if (!task) return showToast("Task not found.", "error");
  state.editingTaskId = taskId;
  $("modalTitle").textContent = "Edit Task";
  $("taskDate").value = task.date;
  $("taskTime").value = task.time || "";
  $("taskName").value = task.taskName;
  $("taskCategory").value = task.category;
  $("taskUrgency").value = task.urgency;
  $("taskStatus").value = task.status;
  $("taskRemarks").value = task.remarks || "";
  openModal($("taskModal"));
}

function closeTaskModal() {
  closeModal($("taskModal"));
  state.editingTaskId = null;
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  const payload = {
    task_date: $("taskDate").value,
    time_slot: $("taskTime").value || null,
    task_name: $("taskName").value.trim(),
    category: $("taskCategory").value,
    urgency: $("taskUrgency").value,
    status: $("taskStatus").value,
    remarks: $("taskRemarks").value.trim()
  };

  if (!payload.task_name) return showToast("Please enter a task name.", "error");
  const isEditing = Boolean(state.editingTaskId);
  const taskId = state.editingTaskId;
  setSaveBusy(true);
  try {
    let result;
    if (isEditing) {
      result = await state.client.from("tasks").update(payload).eq("id", taskId);
    } else {
      result = await state.client.from("tasks").insert({ ...payload, user_id: state.user.id });
    }
    if (result.error) throw result.error;
    closeTaskModal();
    state.archiveLoaded = false;
    await loadDashboard();
    showToast(isEditing ? "Task updated." : "Task added.", "success");
  } catch (error) {
    showToast(error.message || "Could not save task.", "error", 6000);
  } finally {
    setSaveBusy(false);
  }
}

function setSaveBusy(isBusy) {
  $("saveTaskBtn").disabled = isBusy;
  $("saveTaskBtn").textContent = isBusy ? "Saving…" : "Save Task";
}

async function moveTaskByDays(taskId, amount) {
  const task = findTask(taskId);
  if (!task) return showToast("Task not found.", "error");
  await moveTaskToDate(taskId, addDays(task.date, amount));
}

async function moveTaskToDate(taskId, date) {
  const task = findTask(taskId);
  if (!task || task.date === date) return;
  try {
    const { error } = await state.client.from("tasks").update({ task_date: date }).eq("id", taskId);
    if (error) throw error;
    state.archiveLoaded = false;
    await loadDashboard();
    showToast(`Task moved to ${formatMonthDay(date)}.`, "success");
  } catch (error) {
    showToast(error.message || "Could not move task.", "error");
  }
}

async function duplicateTask(taskId) {
  const task = findTask(taskId);
  if (!task) return showToast("Task not found.", "error");
  try {
    const { error } = await state.client.from("tasks").insert({
      user_id: state.user.id,
      task_date: task.date,
      time_slot: task.time || null,
      task_name: `${task.taskName} — Copy`.slice(0, 180),
      category: task.category,
      urgency: task.urgency,
      status: "Pending",
      remarks: task.remarks,
      sort_order: task.sortOrder + 0.01
    });
    if (error) throw error;
    state.archiveLoaded = false;
    await loadDashboard();
    showToast("Task duplicated.", "success");
  } catch (error) {
    showToast(error.message || "Could not duplicate task.", "error");
  }
}

async function toggleTaskCompleted(taskId) {
  const task = findTask(taskId);
  if (!task) return showToast("Task not found.", "error");
  const status = task.status === "Completed" ? "Pending" : "Completed";
  try {
    const { error } = await state.client.from("tasks").update({ status }).eq("id", taskId);
    if (error) throw error;
    state.archiveLoaded = false;
    await loadDashboard();
    showToast(status === "Completed" ? "Task completed." : "Task reopened.", "success");
  } catch (error) {
    showToast(error.message || "Could not update task.", "error");
  }
}

async function deleteTask(taskId) {
  const task = findTask(taskId);
  if (!task) return showToast("Task not found.", "error");
  if (!window.confirm(`Delete “${task.taskName}”? This cannot be undone.`)) return;
  try {
    const { error } = await state.client.from("tasks").delete().eq("id", taskId);
    if (error) throw error;
    state.archiveLoaded = false;
    await loadDashboard();
    showToast("Task deleted.", "success");
  } catch (error) {
    showToast(error.message || "Could not delete task.", "error");
  }
}

async function moveCurrentDayOpenTasksToTomorrow() {
  const ids = state.weekTasks
    .filter(task => task.date === state.focusDate && openStatuses.includes(task.status))
    .map(task => task.id);
  if (!ids.length) return showToast("No open tasks to move from this day.", "info");
  const destination = addDays(state.focusDate, 1);
  if (!window.confirm(`Move ${ids.length} open task(s) to ${formatLongDate(destination)}?`)) return;
  await bulkMoveTasks(ids, destination);
}

function openQueueModal() {
  renderQueue();
  openModal($("queueModal"));
}

function closeQueueModal() {
  closeModal($("queueModal"));
}

function renderQueue() {
  const list = $("queueList");
  const tasks = [...state.openTasks].sort(compareOpenTasks);
  list.innerHTML = tasks.length ? "" : `<div class="empty-state show"><div class="empty-icon">✓</div><h4>No unfinished tasks.</h4><p>Your open-work queue is clear.</p></div>`;
  tasks.forEach(task => {
    const item = document.createElement("label");
    item.className = "queue-item";
    item.innerHTML = `
      <input type="checkbox" data-queue-task="${task.id}" />
      <span class="queue-date">${escapeHTML(formatShortDate(task.date))}</span>
      <span class="queue-main"><strong>${escapeHTML(task.taskName)}</strong><span>${escapeHTML(task.category)} • ${escapeHTML(task.urgency)}</span></span>
      <span class="status status-${slugify(task.status)}">${escapeHTML(task.status)}</span>`;
    list.appendChild(item);
  });
  $("selectAllQueueBtn").textContent = "Select All";
}

function toggleSelectAllQueue() {
  const checkboxes = [...document.querySelectorAll("[data-queue-task]")];
  const shouldSelect = checkboxes.some(box => !box.checked);
  checkboxes.forEach(box => { box.checked = shouldSelect; });
  $("selectAllQueueBtn").textContent = shouldSelect ? "Clear Selection" : "Select All";
}

async function moveSelectedQueueTasks(destination) {
  const ids = [...document.querySelectorAll("[data-queue-task]:checked")].map(box => box.dataset.queueTask);
  if (!ids.length) return showToast("Select at least one task.", "error");
  await bulkMoveTasks(ids, destination);
  closeQueueModal();
}

async function bulkMoveTasks(ids, destination) {
  try {
    const { error } = await state.client.from("tasks").update({ task_date: destination }).in("id", ids);
    if (error) throw error;
    state.focusDate = destination;
    $("focusDateInput").value = destination;
    state.archiveLoaded = false;
    await loadDashboard();
    showToast(`${ids.length} task(s) moved to ${formatLongDate(destination)}.`, "success");
  } catch (error) {
    showToast(error.message || "Could not move selected tasks.", "error", 6000);
  }
}

async function toggleArchive() {
  const content = $("archiveContent");
  const willOpen = content.hidden;
  content.hidden = !willOpen;
  $("archiveToggle").setAttribute("aria-expanded", String(willOpen));
  $("archiveChevron").textContent = willOpen ? "⌃" : "⌄";
  if (willOpen && !state.archiveLoaded) await loadTaskHistory();
}

async function loadTaskHistory() {
  try {
    $("historyTableBody").innerHTML = `<tr><td colspan="6" class="empty-history">Loading recent task history…</td></tr>`;
    const { data, error } = await state.client
      .from("tasks")
      .select("id,user_id,task_date,time_slot,task_name,category,urgency,status,remarks,sort_order,created_at,updated_at,completed_at")
      .order("updated_at", { ascending: false })
      .limit(150);
    if (error) throw error;
    state.historyTasks = (data || []).map(normalizeTask);
    state.archiveLoaded = true;
    renderTaskHistory();
  } catch (error) {
    $("historyTableBody").innerHTML = `<tr><td colspan="6" class="empty-history">Could not load history.</td></tr>`;
    showToast(error.message || "Could not load task history.", "error");
  }
}

function renderTaskHistory() {
  const body = $("historyTableBody");
  const term = $("historySearchInput").value.toLowerCase().trim();
  const status = $("historyStatusFilter").value;
  let tasks = [...state.historyTasks];
  if (term) tasks = tasks.filter(task => [task.taskName, task.remarks, task.category, task.urgency, task.status, task.date].join(" ").toLowerCase().includes(term));
  if (status !== "All Status") tasks = tasks.filter(task => task.status === status);
  body.innerHTML = tasks.length ? "" : `<tr><td colspan="6" class="empty-history">No matching recent tasks.</td></tr>`;
  tasks.forEach(task => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHTML(formatShortDate(task.date))}</td>
      <td><strong>${escapeHTML(task.taskName)}</strong></td>
      <td><span class="pill category-${slugify(task.category)}">${escapeHTML(task.category)}</span></td>
      <td><span class="pill urgency-${slugify(task.urgency)}">${escapeHTML(task.urgency)}</span></td>
      <td><span class="status status-${slugify(task.status)}">${escapeHTML(task.status)}</span></td>
      <td>${escapeHTML(formatDateTime(task.updatedAt))}</td>`;
    body.appendChild(row);
  });
}

function setupRealtime() {
  teardownRealtime();
  if (!CONFIG.enableRealtime || !state.client || !state.user) {
    setSyncStatus("connected");
    return;
  }

  state.realtimeChannel = state.client
    .channel(`designlab-tasks-${state.user.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
      window.clearTimeout(state.refreshTimer);
      state.refreshTimer = window.setTimeout(() => loadDashboard(), 450);
    })
    .subscribe(status => {
      if (status === "SUBSCRIBED") setSyncStatus("live");
      if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) setSyncStatus("error");
    });
}

function teardownRealtime() {
  if (state.realtimeChannel && state.client) state.client.removeChannel(state.realtimeChannel);
  state.realtimeChannel = null;
}

function setSyncStatus(status) {
  const labels = {
    syncing: "Supabase: syncing…",
    connected: "Supabase: connected",
    live: "Supabase: live",
    error: "Supabase: connection issue"
  };
  $("syncStatus").textContent = labels[status] || labels.connected;
}

function findTask(taskId) {
  return state.weekTasks.find(task => task.id === taskId)
    || state.openTasks.find(task => task.id === taskId)
    || state.historyTasks.find(task => task.id === taskId);
}

function isTaskOverdue(task) {
  return openStatuses.includes(task.status) && task.date < formatDateForInput(new Date());
}

function openModal(modal) {
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(modal) {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".modal.show")) document.body.style.overflow = "";
}

function parseDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateString, amount) {
  const date = parseDate(dateString);
  date.setDate(date.getDate() + amount);
  return formatDateForInput(date);
}

function formatDateForInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatLongDate(value) {
  return parseDate(value).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatShortDate(value) {
  return parseDate(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMonthDay(value) {
  return parseDate(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatWeekday(value) {
  return parseDate(value).toLocaleDateString("en-US", { weekday: "long" });
}

function formatWeekdayShort(value) {
  return parseDate(value).toLocaleDateString("en-US", { weekday: "short" });
}

function formatWeekRange(start, end) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  const sameMonth = startDate.getMonth() === endDate.getMonth();
  if (sameMonth) {
    return `${startDate.toLocaleDateString("en-US", { month: "long" })} ${startDate.getDate()}–${endDate.getDate()}, ${endDate.getFullYear()}`;
  }
  return `${formatMonthDay(start)} – ${formatMonthDay(end)}, ${endDate.getFullYear()}`;
}

function formatTimeDisplay(value) {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function titleCase(value) {
  return String(value).toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
}

function slugify(value) {
  return String(value || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = "success", duration = 3000) {
  const toast = $("toast");
  toast.className = `toast ${type} show`;
  toast.textContent = message;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), duration);
}
