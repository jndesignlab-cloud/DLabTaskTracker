/* ======================================================
   DesignLab Daily Tracker
   script.js
   Frontend controller for HTML + CSS + Apps Script backend
====================================================== */

const API_URL = "https://script.google.com/macros/s/AKfycbxlo1kTf-oLJZw4K2K6id5zneynwjln66f98n6EETF2kySwpta3a45zYT_2K_FJNNXN/exec";

/* =========================
   App State
========================= */

let tasks = [];
let editingTaskId = null;

const categoryOptions = [
  "PERSONAL",
  "PAGE",
  "BUSINESS",
  "WORK",
  "LEISURE"
];

const urgencyOptions = [
  "Today’s Priority",
  "High Priority",
  "Weekly Task",
  "Daily Task",
  "Low Priority"
];

const statusOptions = [
  "Pending",
  "In Progress",
  "Completed",
  "Cancelled"
];

/* =========================
   DOM Elements
========================= */

const dateDisplay = document.getElementById("dateDisplay");
const timeDisplay = document.getElementById("timeDisplay");

const todayTasksCount = document.getElementById("todayTasksCount");
const completedCount = document.getElementById("completedCount");
const pendingCount = document.getElementById("pendingCount");
const highPriorityCount = document.getElementById("highPriorityCount");

const taskTableBody = document.getElementById("taskTableBody");
const historyTableBody = document.getElementById("historyTableBody");

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const urgencyFilter = document.getElementById("urgencyFilter");
const statusFilter = document.getElementById("statusFilter");
const dateFilter = document.getElementById("dateFilter");

const addTaskBtn = document.getElementById("addTaskBtn");
const taskModal = document.getElementById("taskModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelTaskBtn = document.getElementById("cancelTaskBtn");
const taskForm = document.getElementById("taskForm");
const modalTitle = document.getElementById("modalTitle");

const taskDateInput = document.getElementById("taskDate");
const taskTimeInput = document.getElementById("taskTime");
const taskNameInput = document.getElementById("taskName");
const taskCategoryInput = document.getElementById("taskCategory");
const taskUrgencyInput = document.getElementById("taskUrgency");
const taskStatusInput = document.getElementById("taskStatus");
const taskRemarksInput = document.getElementById("taskRemarks");

const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");

/* =========================
   Initial Load
========================= */

document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
});

function initializeApp() {
  setupCurrentDate();
  setupLiveClock();
  setupDropdowns();
  setupEventListeners();
  loadTasks();
}

/* =========================
   Date and Time
========================= */

function setupCurrentDate() {
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  if (dateDisplay) {
    dateDisplay.textContent = formattedDate;
  }

  if (dateFilter) {
    dateFilter.value = formatDateForInput(today);
  }

  if (taskDateInput) {
    taskDateInput.value = formatDateForInput(today);
  }
}

function setupLiveClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();

  const formattedTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  if (timeDisplay) {
    timeDisplay.textContent = formattedTime;
  }
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(dateString) {
  if (!dateString) return "No date";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

/* =========================
   Dropdown Setup
========================= */

function setupDropdowns() {
  populateSelect(categoryFilter, ["All Categories", ...categoryOptions]);
  populateSelect(urgencyFilter, ["All Urgencies", ...urgencyOptions]);
  populateSelect(statusFilter, ["All Status", ...statusOptions]);

  populateSelect(taskCategoryInput, categoryOptions);
  populateSelect(taskUrgencyInput, urgencyOptions);
  populateSelect(taskStatusInput, statusOptions);
}

function populateSelect(selectElement, options) {
  if (!selectElement) return;

  selectElement.innerHTML = "";

  options.forEach(option => {
    const optionElement = document.createElement("option");
    optionElement.value = option;
    optionElement.textContent = option;
    selectElement.appendChild(optionElement);
  });
}

/* =========================
   Event Listeners
========================= */

function setupEventListeners() {
  if (addTaskBtn) {
    addTaskBtn.addEventListener("click", openAddModal);
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeModal);
  }

  if (cancelTaskBtn) {
    cancelTaskBtn.addEventListener("click", closeModal);
  }

  if (taskForm) {
    taskForm.addEventListener("submit", handleTaskSubmit);
  }

  if (searchInput) {
    searchInput.addEventListener("input", renderTasks);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener("change", renderTasks);
  }

  if (urgencyFilter) {
    urgencyFilter.addEventListener("change", renderTasks);
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", renderTasks);
  }

  if (dateFilter) {
    dateFilter.addEventListener("change", loadTasks);
  }

  window.addEventListener("click", event => {
    if (event.target === taskModal) {
      closeModal();
    }
  });
}

/* =========================
   API Helpers
========================= */

async function apiGet(params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const url = `${API_URL}?${queryString}`;

  const response = await fetch(url);
  return response.json();
}

async function apiPost(payload = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return response.json();
}

/* =========================
   Load Tasks
========================= */

async function loadTasks() {
  showLoading(true);

  try {
    const selectedDate = dateFilter ? dateFilter.value : formatDateForInput(new Date());

    const result = await apiGet({
      action: "getTasks",
      date: selectedDate
    });

    if (!result.success) {
      throw new Error(result.message || "Failed to load tasks.");
    }

    tasks = result.tasks || [];

    renderDashboardStats();
    renderTasks();
    loadTaskHistory();

  } catch (error) {
    console.error(error);
    showToast("Could not load tasks. Please check your Apps Script URL.", "error");
  } finally {
    showLoading(false);
  }
}

/* =========================
   Load Previous Tasks
========================= */

async function loadTaskHistory() {
  if (!historyTableBody) return;

  try {
    const result = await apiGet({
      action: "getTasks"
    });

    if (!result.success) {
      throw new Error(result.message || "Failed to load task history.");
    }

    const allTasks = result.tasks || [];
    const today = dateFilter ? dateFilter.value : formatDateForInput(new Date());

    const previousTasks = allTasks
      .filter(task => task.date < today)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);

    renderTaskHistory(previousTasks);

  } catch (error) {
    console.error(error);
  }
}

/* =========================
   Render Dashboard Stats
========================= */

function renderDashboardStats() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.status === "Completed").length;
  const pending = tasks.filter(task => task.status === "Pending").length;
  const highPriority = tasks.filter(task =>
    task.urgency === "Today’s Priority" || task.urgency === "High Priority"
  ).length;

  if (todayTasksCount) todayTasksCount.textContent = total;
  if (completedCount) completedCount.textContent = completed;
  if (pendingCount) pendingCount.textContent = pending;
  if (highPriorityCount) highPriorityCount.textContent = highPriority;
}

/* =========================
   Render Tasks
========================= */

function renderTasks() {
  if (!taskTableBody) return;

  const filteredTasks = getFilteredTasks();

  taskTableBody.innerHTML = "";

  if (filteredTasks.length === 0) {
    showEmptyState(true);
    return;
  }

  showEmptyState(false);

  filteredTasks.forEach(task => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <div class="task-name">${escapeHTML(task.taskName)}</div>
        ${task.remarks ? `<div class="task-remarks">${escapeHTML(task.remarks)}</div>` : ""}
      </td>

      <td>${escapeHTML(task.timeSlot || "—")}</td>

      <td>
        <span class="pill category-${slugify(task.category)}">
          ${escapeHTML(task.category)}
        </span>
      </td>

      <td>
        <span class="pill urgency-${slugify(task.urgency)}">
          ${escapeHTML(task.urgency)}
        </span>
      </td>

      <td>
        <span class="status status-${slugify(task.status)}">
          ${escapeHTML(task.status)}
        </span>
      </td>

      <td>
        <div class="action-buttons">
          <button class="icon-btn edit" title="Edit task" onclick="openEditModal('${task.taskId}')">
            ✎
          </button>

          <button class="icon-btn delete" title="Delete task" onclick="handleDeleteTask('${task.taskId}')">
            🗑
          </button>

          <button class="icon-btn complete" title="Mark as completed" onclick="handleCompleteTask('${task.taskId}')">
            ✓
          </button>
        </div>
      </td>
    `;

    taskTableBody.appendChild(row);
  });
}

function getFilteredTasks() {
  let filtered = [...tasks];

  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const selectedCategory = categoryFilter ? categoryFilter.value : "All Categories";
  const selectedUrgency = urgencyFilter ? urgencyFilter.value : "All Urgencies";
  const selectedStatus = statusFilter ? statusFilter.value : "All Status";

  if (searchTerm) {
    filtered = filtered.filter(task =>
      task.taskName.toLowerCase().includes(searchTerm) ||
      task.remarks.toLowerCase().includes(searchTerm) ||
      task.category.toLowerCase().includes(searchTerm) ||
      task.urgency.toLowerCase().includes(searchTerm)
    );
  }

  if (selectedCategory !== "All Categories") {
    filtered = filtered.filter(task => task.category === selectedCategory);
  }

  if (selectedUrgency !== "All Urgencies") {
    filtered = filtered.filter(task => task.urgency === selectedUrgency);
  }

  if (selectedStatus !== "All Status") {
    filtered = filtered.filter(task => task.status === selectedStatus);
  }

  return filtered.sort((a, b) => convertTimeToMinutes(a.timeSlot) - convertTimeToMinutes(b.timeSlot));
}

/* =========================
   Render Task History
========================= */

function renderTaskHistory(historyTasks) {
  if (!historyTableBody) return;

  historyTableBody.innerHTML = "";

  if (historyTasks.length === 0) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-history">
          No previous tasks found.
        </td>
      </tr>
    `;
    return;
  }

  historyTasks.forEach(task => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${formatDateForDisplay(task.date)}</td>

      <td>${escapeHTML(task.taskName)}</td>

      <td>
        <span class="pill category-${slugify(task.category)}">
          ${escapeHTML(task.category)}
        </span>
      </td>

      <td>
        <span class="pill urgency-${slugify(task.urgency)}">
          ${escapeHTML(task.urgency)}
        </span>
      </td>

      <td>
        <span class="status status-${slugify(task.status)}">
          ${escapeHTML(task.status)}
        </span>
      </td>

      <td>${escapeHTML(task.completedAt || "—")}</td>
    `;

    historyTableBody.appendChild(row);
  });
}

/* =========================
   Modal Handling
========================= */

function openAddModal() {
  editingTaskId = null;

  if (modalTitle) {
    modalTitle.textContent = "Add New Task";
  }

  if (taskForm) {
    taskForm.reset();
  }

  if (taskDateInput) {
    taskDateInput.value = dateFilter ? dateFilter.value : formatDateForInput(new Date());
  }

  if (taskStatusInput) {
    taskStatusInput.value = "Pending";
  }

  openModal();
}

function openEditModal(taskId) {
  const task = tasks.find(item => item.taskId === taskId);

  if (!task) {
    showToast("Task not found.", "error");
    return;
  }

  editingTaskId = taskId;

  if (modalTitle) {
    modalTitle.textContent = "Edit Task";
  }

  taskDateInput.value = task.date || "";
  taskTimeInput.value = task.timeSlot || "";
  taskNameInput.value = task.taskName || "";
  taskCategoryInput.value = task.category || "WORK";
  taskUrgencyInput.value = task.urgency || "Low Priority";
  taskStatusInput.value = task.status || "Pending";
  taskRemarksInput.value = task.remarks || "";

  openModal();
}

function openModal() {
  if (taskModal) {
    taskModal.classList.add("show");
  }
}

function closeModal() {
  if (taskModal) {
    taskModal.classList.remove("show");
  }

  editingTaskId = null;
}

/* =========================
   Add / Update Task
========================= */

async function handleTaskSubmit(event) {
  event.preventDefault();

  const payload = {
    date: taskDateInput.value,
    timeSlot: formatTimeFromInput(taskTimeInput.value),
    taskName: taskNameInput.value.trim(),
    category: taskCategoryInput.value,
    urgency: taskUrgencyInput.value,
    status: taskStatusInput.value,
    remarks: taskRemarksInput.value.trim()
  };

  if (!payload.taskName) {
    showToast("Please enter a task name.", "error");
    return;
  }

  try {
    let result;

    if (editingTaskId) {
      result = await apiPost({
        action: "updateTask",
        taskId: editingTaskId,
        ...payload
      });
    } else {
      result = await apiPost({
        action: "addTask",
        ...payload
      });
    }

    if (!result.success) {
      throw new Error(result.message || "Task save failed.");
    }

    showToast(editingTaskId ? "Task updated successfully." : "Task added successfully.", "success");

    closeModal();
    await loadTasks();

  } catch (error) {
    console.error(error);
    showToast("Could not save task.", "error");
  }
}

/* =========================
   Delete Task
========================= */

async function handleDeleteTask(taskId) {
  const confirmed = confirm("Delete this task? This cannot be undone.");

  if (!confirmed) return;

  try {
    const result = await apiPost({
      action: "deleteTask",
      taskId
    });

    if (!result.success) {
      throw new Error(result.message || "Delete failed.");
    }

    showToast("Task deleted successfully.", "success");
    await loadTasks();

  } catch (error) {
    console.error(error);
    showToast("Could not delete task.", "error");
  }
}

/* =========================
   Complete Task
========================= */

async function handleCompleteTask(taskId) {
  try {
    const result = await apiPost({
      action: "completeTask",
      taskId
    });

    if (!result.success) {
      throw new Error(result.message || "Update failed.");
    }

    showToast("Task marked as completed.", "success");
    await loadTasks();

  } catch (error) {
    console.error(error);
    showToast("Could not update task.", "error");
  }
}

/* =========================
   Helpers
========================= */

function formatTimeFromInput(value) {
  if (!value) return "";

  if (value.includes("AM") || value.includes("PM")) {
    return value;
  }

  const [hours, minutes] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours));
  date.setMinutes(Number(minutes));

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function convertTimeToMinutes(timeString) {
  if (!timeString) return 99999;

  const date = new Date(`01/01/2000 ${timeString}`);

  if (isNaN(date.getTime())) {
    return 99999;
  }

  return date.getHours() * 60 + date.getMinutes();
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showLoading(isLoading) {
  if (!loadingState) return;

  loadingState.style.display = isLoading ? "block" : "none";
}

function showEmptyState(isEmpty) {
  if (!emptyState) return;

  emptyState.style.display = isEmpty ? "block" : "none";
}

/* =========================
   Toast Notification
========================= */

function showToast(message, type = "success") {
  let toast = document.getElementById("toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }

  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
