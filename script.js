(function () {
  "use strict";

  const KEYS = {
    courses: "studyPlanner.courses",
    tasks: "studyPlanner.tasks",
    sessions: "studyPlanner.sessions",
    name: "studyPlanner.name",
    initialized: "studyPlanner.initialized",
  };
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const COLORS = ["#8b5cf6", "#6b46c1", "#c084fc", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];
  const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

  const state = { courses: [], tasks: [], sessions: [], name: "Student" };
  const ui = { statusFilter: "all", courseFilter: "all", sort: "due", selectedColor: COLORS[0] };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---------- Utilities ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function safeColor(color) {
    return /^#[0-9a-f]{6}$/i.test(color) ? color : COLORS[0];
  }

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(n) {
    const d = startOfToday();
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }

  function parseDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function daysUntil(iso) {
    return Math.round((parseDate(iso) - startOfToday()) / 86400000);
  }

  function formatDue(iso) {
    const diff = daysUntil(iso);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    if (diff < 0) return `${Math.abs(diff)} days ago`;
    if (diff < 7) return `In ${diff} days`;
    return parseDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function todayIndex() {
    return (new Date().getDay() + 6) % 7; // Monday = 0
  }

  function minutes(time) {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  function formatTime(time) {
    const [h, m] = time.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function courseById(id) {
    return state.courses.find((c) => c.id === id);
  }

  function percent(done, total) {
    return total ? Math.round((done / total) * 100) : 0;
  }

  let toastTimer;
  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // ---------- Storage ----------
  function save() {
    try {
      localStorage.setItem(KEYS.courses, JSON.stringify(state.courses));
      localStorage.setItem(KEYS.tasks, JSON.stringify(state.tasks));
      localStorage.setItem(KEYS.sessions, JSON.stringify(state.sessions));
      localStorage.setItem(KEYS.name, state.name);
      localStorage.setItem(KEYS.initialized, "1");
    } catch (err) {
      toast("Could not save data in this browser.");
    }
  }

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function load() {
    let initialized = false;
    try {
      initialized = localStorage.getItem(KEYS.initialized) === "1";
    } catch {
      initialized = false;
    }
    if (!initialized) {
      seed();
      return;
    }
    state.courses = readArray(KEYS.courses);
    state.tasks = readArray(KEYS.tasks);
    state.sessions = readArray(KEYS.sessions);
    state.name = localStorage.getItem(KEYS.name) || "Student";
  }

  function seed() {
    const c1 = { id: uid(), name: "Introduction to Psychology", code: "PSY 101", instructor: "Dr. Emily Carter", credits: 3, color: "#8b5cf6" };
    const c2 = { id: uid(), name: "Calculus II", code: "MATH 152", instructor: "Prof. Alan Reyes", credits: 4, color: "#ec4899" };
    const c3 = { id: uid(), name: "Data Structures", code: "CS 210", instructor: "Dr. Priya Nair", credits: 4, color: "#3b82f6" };
    const c4 = { id: uid(), name: "Academic Writing", code: "ENG 120", instructor: "Ms. Sarah Lee", credits: 2, color: "#10b981" };
    state.courses = [c1, c2, c3, c4];

    state.tasks = [
      { id: uid(), title: "Read chapters 3 & 4", courseId: c1.id, due: addDays(1), priority: "medium", notes: "Take notes on memory models.", done: false },
      { id: uid(), title: "Problem set 5: Integration by parts", courseId: c2.id, due: addDays(2), priority: "high", notes: "", done: false },
      { id: uid(), title: "Implement linked list assignment", courseId: c3.id, due: addDays(4), priority: "high", notes: "Include unit tests.", done: false },
      { id: uid(), title: "Draft argumentative essay outline", courseId: c4.id, due: addDays(6), priority: "medium", notes: "", done: false },
      { id: uid(), title: "Midterm exam revision", courseId: c2.id, due: addDays(10), priority: "high", notes: "Series and sequences.", done: false },
      { id: uid(), title: "Watch lecture recording week 6", courseId: c3.id, due: addDays(-1), priority: "low", notes: "", done: true },
      { id: uid(), title: "Submit reading reflection", courseId: c1.id, due: addDays(-2), priority: "low", notes: "", done: true },
    ];

    state.sessions = [
      { id: uid(), day: 0, start: "09:00", end: "10:30", courseId: c2.id, topic: "Practice integrals" },
      { id: uid(), day: 0, start: "14:00", end: "15:00", courseId: c1.id, topic: "Chapter 3 reading" },
      { id: uid(), day: 1, start: "10:00", end: "12:00", courseId: c3.id, topic: "Linked list coding" },
      { id: uid(), day: 2, start: "16:00", end: "17:00", courseId: c4.id, topic: "Essay outline" },
      { id: uid(), day: 3, start: "09:30", end: "11:00", courseId: c2.id, topic: "Problem set 5" },
      { id: uid(), day: 4, start: "13:00", end: "14:30", courseId: c3.id, topic: "Review lecture notes" },
      { id: uid(), day: 5, start: "11:00", end: "13:00", courseId: c2.id, topic: "Midterm revision" },
    ];
    state.name = "Student";
    save();
  }

  // ---------- Navigation ----------
  function showSection(id) {
    $$(".section").forEach((s) => s.classList.toggle("active", s.id === id));
    $$(".nav-link").forEach((b) => b.classList.toggle("active", b.dataset.section === id));
    closeMenu();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  }

  function openMenu() {
    $("#sidebar").classList.add("open");
    $("#overlay").classList.add("show");
    $("#menuToggle").setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    $("#sidebar").classList.remove("open");
    $("#overlay").classList.remove("show");
    $("#menuToggle").setAttribute("aria-expanded", "false");
  }

  // ---------- Rendering ----------
  function renderAll() {
    renderCourseOptions();
    renderDashboard();
    renderCourses();
    renderTasks();
    renderPlanner();
    renderProgress();
  }

  function renderCourseOptions() {
    const options = state.courses
      .map((c) => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.code ? c.code + " – " + c.name : c.name)}</option>`)
      .join("");

    $("#taskCourse").innerHTML = `<option value="">No course</option>` + options;
    $("#sessionCourse").innerHTML = `<option value="">General study</option>` + options;

    const filter = $("#courseFilter");
    filter.innerHTML = `<option value="all">All courses</option><option value="none">No course</option>` + options;
    if (ui.courseFilter !== "all" && ui.courseFilter !== "none" && !courseById(ui.courseFilter)) ui.courseFilter = "all";
    filter.value = ui.courseFilter;
  }

  function renderDashboard() {
    const hour = new Date().getHours();
    $("#greeting").textContent = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    $("#studentName").textContent = state.name;
    $("#todayDate").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    const pending = state.tasks.filter((t) => !t.done);
    const overdue = pending.filter((t) => daysUntil(t.due) < 0);
    const dueWeek = pending.filter((t) => { const d = daysUntil(t.due); return d >= 0 && d <= 7; });
    const doneCount = state.tasks.length - pending.length;
    const pct = percent(doneCount, state.tasks.length);
    const credits = state.courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);

    $("#statCourses").textContent = state.courses.length;
    $("#statCredits").textContent = `${credits} credit${credits === 1 ? "" : "s"}`;
    $("#statPending").textContent = pending.length;
    $("#statOverdue").textContent = `${overdue.length} overdue`;
    $("#statWeek").textContent = dueWeek.length;
    $("#statProgress").textContent = pct + "%";
    $("#statDoneCount").textContent = `${doneCount} of ${state.tasks.length} tasks`;

    const dueToday = pending.filter((t) => daysUntil(t.due) === 0).length;
    $("#heroMessage").textContent = overdue.length
      ? `You have ${overdue.length} overdue task${overdue.length > 1 ? "s" : ""}. Let's catch up!`
      : dueToday
        ? `${dueToday} task${dueToday > 1 ? "s are" : " is"} due today. You've got this!`
        : pending.length
          ? "You're on track. Let's make today productive."
          : "All caught up! Enjoy your free time.";

    const upcoming = [...pending].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
    $("#upcomingList").innerHTML = upcoming.length
      ? upcoming.map((t) => {
          const c = courseById(t.courseId);
          return `<li class="mini-item">
            <span class="dot" style="background:${safeColor(c?.color)}"></span>
            <div class="grow">
              <div class="title">${escapeHTML(t.title)}</div>
              <div class="meta">${escapeHTML(c ? c.code || c.name : "No course")} · ${dueBadgeText(t)}</div>
            </div>
            <span class="badge ${t.priority}">${t.priority}</span>
          </li>`;
        }).join("")
      : `<li class="empty"><strong>No upcoming tasks</strong>Add a task to get started.</li>`;

    const today = sessionsForDay(todayIndex());
    $("#todaySessions").innerHTML = today.length
      ? today.map((s) => {
          const c = courseById(s.courseId);
          return `<li class="mini-item">
            <span class="dot" style="background:${safeColor(c?.color)}"></span>
            <div class="grow">
              <div class="title">${escapeHTML(c ? c.name : "General study")}</div>
              <div class="meta">${formatTime(s.start)} – ${formatTime(s.end)}${s.topic ? " · " + escapeHTML(s.topic) : ""}</div>
            </div>
          </li>`;
        }).join("")
      : `<li class="empty"><strong>No sessions today</strong>Plan one in the weekly planner.</li>`;
  }

  function dueBadgeText(task) {
    const diff = daysUntil(task.due);
    const label = formatDue(task.due);
    if (diff < 0 && !task.done) return `Overdue (${label})`;
    return diff >= 0 && diff < 7 ? `Due ${label.toLowerCase()}` : `Due ${label}`;
  }

  function renderCourses() {
    const grid = $("#courseGrid");
    if (!state.courses.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><strong>No courses yet</strong>Click “Add course” to add your first course.</div>`;
      return;
    }
    grid.innerHTML = state.courses.map((c) => {
      const tasks = state.tasks.filter((t) => t.courseId === c.id);
      const done = tasks.filter((t) => t.done).length;
      const pct = percent(done, tasks.length);
      const hours = state.sessions
        .filter((s) => s.courseId === c.id)
        .reduce((sum, s) => sum + (minutes(s.end) - minutes(s.start)) / 60, 0);
      return `<article class="course-card" style="--c:${safeColor(c.color)}">
        <div class="course-top">
          <div>
            <div class="course-code">${escapeHTML(c.code || "Course")}</div>
            <div class="course-name">${escapeHTML(c.name)}</div>
          </div>
          <div class="course-actions">
            <button class="icon-btn" data-action="edit-course" data-id="${c.id}" aria-label="Edit course" title="Edit">&#9998;</button>
            <button class="icon-btn danger" data-action="delete-course" data-id="${c.id}" aria-label="Delete course" title="Delete">&#128465;</button>
          </div>
        </div>
        <div class="course-meta">
          <span>&#128100; ${escapeHTML(c.instructor || "Instructor not set")}</span>
          <span>&#127891; ${Number(c.credits) || 0} credits · &#9201; ${+hours.toFixed(1)} h/week planned</span>
        </div>
        <div class="course-progress">
          <div class="row"><span>${done}/${tasks.length} tasks done</span><span>${pct}%</span></div>
          <div class="bar"><span style="width:${pct}%;background:${safeColor(c.color)}"></span></div>
        </div>
      </article>`;
    }).join("");
  }

  function renderTasks() {
    let list = state.tasks.slice();
    if (ui.statusFilter === "pending") list = list.filter((t) => !t.done);
    if (ui.statusFilter === "completed") list = list.filter((t) => t.done);
    if (ui.courseFilter === "none") list = list.filter((t) => !courseById(t.courseId));
    else if (ui.courseFilter !== "all") list = list.filter((t) => t.courseId === ui.courseFilter);

    list.sort((a, b) => {
      if (ui.sort === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.due.localeCompare(b.due);
      if (ui.sort === "title") return a.title.localeCompare(b.title);
      return a.due.localeCompare(b.due) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    });
    if (ui.sort !== "title") list.sort((a, b) => Number(a.done) - Number(b.done));

    const el = $("#taskList");
    if (!list.length) {
      el.innerHTML = `<li class="empty"><strong>No tasks here</strong>${state.tasks.length ? "Try a different filter." : "Click “Add task” to create one."}</li>`;
      return;
    }
    el.innerHTML = list.map((t) => {
      const c = courseById(t.courseId);
      const diff = daysUntil(t.due);
      let dueBadge = `<span>&#128197; ${escapeHTML(formatDue(t.due))}</span>`;
      if (!t.done && diff < 0) dueBadge = `<span class="badge overdue">Overdue · ${escapeHTML(formatDue(t.due))}</span>`;
      else if (!t.done && diff === 0) dueBadge = `<span class="badge today">Due today</span>`;
      return `<li class="task ${t.done ? "done" : ""}" style="--c:${safeColor(c?.color)}">
        <label class="check" title="Mark as ${t.done ? "not done" : "done"}">
          <input type="checkbox" data-action="toggle-task" data-id="${t.id}" ${t.done ? "checked" : ""} aria-label="Mark ${escapeHTML(t.title)} as complete" />
          <span></span>
        </label>
        <div class="task-body">
          <div class="task-title">${escapeHTML(t.title)}</div>
          ${t.notes ? `<div class="task-notes">${escapeHTML(t.notes)}</div>` : ""}
          <div class="task-meta">
            <span class="badge course">${escapeHTML(c ? c.code || c.name : "No course")}</span>
            <span class="badge ${t.priority}">${t.priority} priority</span>
            ${dueBadge}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-action="edit-task" data-id="${t.id}" aria-label="Edit task" title="Edit">&#9998;</button>
          <button class="icon-btn danger" data-action="delete-task" data-id="${t.id}" aria-label="Delete task" title="Delete">&#128465;</button>
        </div>
      </li>`;
    }).join("");
  }

  function sessionsForDay(day) {
    return state.sessions.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start));
  }

  function renderPlanner() {
    const today = todayIndex();
    let totalMinutes = 0;
    $("#weekGrid").innerHTML = DAYS.map((name, i) => {
      const sessions = sessionsForDay(i);
      const mins = sessions.reduce((sum, s) => sum + minutes(s.end) - minutes(s.start), 0);
      totalMinutes += mins;
      const items = sessions.map((s) => {
        const c = courseById(s.courseId);
        return `<div class="session" style="--c:${safeColor(c?.color)}">
          <div class="session-time">${formatTime(s.start)} – ${formatTime(s.end)}</div>
          <div class="session-course">${escapeHTML(c ? c.name : "General study")}</div>
          ${s.topic ? `<div class="session-topic">${escapeHTML(s.topic)}</div>` : ""}
          <div class="session-actions">
            <button class="icon-btn" data-action="edit-session" data-id="${s.id}" aria-label="Edit session" title="Edit">&#9998;</button>
            <button class="icon-btn danger" data-action="delete-session" data-id="${s.id}" aria-label="Delete session" title="Delete">&#128465;</button>
          </div>
        </div>`;
      }).join("");
      return `<div class="day ${i === today ? "today" : ""}">
        <div class="day-head">
          <h3>${name}${i === today ? " · Today" : ""}</h3>
          <span class="muted">${sessions.length} session${sessions.length === 1 ? "" : "s"} · ${+(mins / 60).toFixed(1)} h</span>
        </div>
        <div class="day-body">
          ${items || `<div class="day-empty">Free day</div>`}
          <button class="add-session" data-action="add-session" data-day="${i}">+ Add</button>
        </div>
      </div>`;
    }).join("");
    $("#weekHours").textContent = `${+(totalMinutes / 60).toFixed(1)} h planned`;
  }

  function renderProgress() {
    const total = state.tasks.length;
    const done = state.tasks.filter((t) => t.done).length;
    const pct = percent(done, total);
    $("#progressRing").style.setProperty("--p", pct);
    $("#ringValue").textContent = pct + "%";
    $("#ringLabel").textContent = `${done} of ${total} tasks`;
    $("#progressMessage").textContent = !total
      ? "Add some tasks to start tracking progress."
      : pct === 100 ? "Amazing! Every task is complete."
      : pct >= 75 ? "Almost there — keep going!"
      : pct >= 40 ? "Solid progress. Stay consistent!"
      : "Every step counts. You can do it!";

    const bar = (label, d, t, color) => {
      const p = percent(d, t);
      return `<div class="bar-row">
        <div class="row"><strong>${label}</strong><span>${d}/${t} · ${p}%</span></div>
        <div class="bar"><span style="width:${p}%${color ? ";background:" + color : ""}"></span></div>
      </div>`;
    };

    const priorityColors = { high: "#e0466b", medium: "#f2a03d", low: "#2fb38a" };
    $("#priorityProgress").innerHTML = ["high", "medium", "low"].map((p) => {
      const tasks = state.tasks.filter((t) => t.priority === p);
      return bar(p[0].toUpperCase() + p.slice(1) + " priority", tasks.filter((t) => t.done).length, tasks.length, priorityColors[p]);
    }).join("");

    $("#courseProgress").innerHTML = state.courses.length
      ? state.courses.map((c) => {
          const tasks = state.tasks.filter((t) => t.courseId === c.id);
          return bar(escapeHTML(c.code ? `${c.code} – ${c.name}` : c.name), tasks.filter((t) => t.done).length, tasks.length, safeColor(c.color));
        }).join("")
      : `<div class="empty"><strong>No courses yet</strong>Add courses to see progress per course.</div>`;

    const pending = state.tasks.filter((t) => !t.done);
    const dueWeek = pending.filter((t) => { const d = daysUntil(t.due); return d >= 0 && d <= 7; }).length;
    const overdue = pending.filter((t) => daysUntil(t.due) < 0).length;
    const hours = state.sessions.reduce((sum, s) => sum + (minutes(s.end) - minutes(s.start)) / 60, 0);
    $("#weekStats").innerHTML = `
      <div class="week-stat"><b>${+hours.toFixed(1)}</b><span>study hours planned</span></div>
      <div class="week-stat"><b>${dueWeek}</b><span>tasks due in 7 days</span></div>
      <div class="week-stat"><b>${overdue}</b><span>overdue tasks</span></div>`;
  }

  // ---------- Modals ----------
  function openModal(id) {
    const modal = document.getElementById(id);
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
    const first = modal.querySelector("input:not([type=hidden]), select, textarea");
    if (first) setTimeout(() => first.focus(), 30);
  }

  function closeModal(modal) {
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  }

  function renderSwatches() {
    $("#courseColors").innerHTML = COLORS.map((c) =>
      `<button type="button" class="swatch ${c === ui.selectedColor ? "selected" : ""}" style="--c:${c}" data-color="${c}" aria-label="Color ${c}"></button>`
    ).join("");
  }

  function openCourseModal(id) {
    const c = id ? courseById(id) : null;
    $("#courseModalTitle").textContent = c ? "Edit course" : "Add course";
    $("#courseId").value = c ? c.id : "";
    $("#courseName").value = c ? c.name : "";
    $("#courseCode").value = c ? c.code : "";
    $("#courseCredits").value = c ? c.credits : "";
    $("#courseInstructor").value = c ? c.instructor : "";
    ui.selectedColor = c ? safeColor(c.color) : COLORS[state.courses.length % COLORS.length];
    $("#courseError").textContent = "";
    renderSwatches();
    openModal("courseModal");
  }

  function openTaskModal(id) {
    const t = id ? state.tasks.find((x) => x.id === id) : null;
    $("#taskModalTitle").textContent = t ? "Edit task" : "Add task";
    $("#taskId").value = t ? t.id : "";
    $("#taskTitle").value = t ? t.title : "";
    $("#taskCourse").value = t && courseById(t.courseId) ? t.courseId : (ui.courseFilter !== "all" && ui.courseFilter !== "none" ? ui.courseFilter : "");
    $("#taskDue").value = t ? t.due : addDays(1);
    $("#taskNotes").value = t ? t.notes || "" : "";
    const priority = t ? t.priority : "medium";
    $$('input[name="priority"]').forEach((r) => (r.checked = r.value === priority));
    $("#taskError").textContent = "";
    openModal("taskModal");
  }

  function openSessionModal(id, day) {
    const s = id ? state.sessions.find((x) => x.id === id) : null;
    $("#sessionModalTitle").textContent = s ? "Edit study session" : "Add study session";
    $("#sessionId").value = s ? s.id : "";
    $("#sessionDay").value = String(s ? s.day : day ?? todayIndex());
    $("#sessionStart").value = s ? s.start : "09:00";
    $("#sessionEnd").value = s ? s.end : "10:00";
    $("#sessionCourse").value = s && courseById(s.courseId) ? s.courseId : "";
    $("#sessionTopic").value = s ? s.topic || "" : "";
    $("#sessionError").textContent = "";
    openModal("sessionModal");
  }

  let pendingConfirm = null;
  function confirmAction(title, text, onConfirm) {
    $("#confirmTitle").textContent = title;
    $("#confirmText").textContent = text;
    pendingConfirm = onConfirm;
    openModal("confirmModal");
  }

  // ---------- Actions ----------
  function saveCourse(e) {
    e.preventDefault();
    const name = $("#courseName").value.trim();
    if (!name) {
      $("#courseError").textContent = "Please enter a course name.";
      $("#courseName").focus();
      return;
    }
    const credits = parseFloat($("#courseCredits").value);
    const data = {
      name,
      code: $("#courseCode").value.trim(),
      instructor: $("#courseInstructor").value.trim(),
      credits: Number.isFinite(credits) && credits >= 0 ? credits : 0,
      color: safeColor(ui.selectedColor),
    };
    const id = $("#courseId").value;
    const existing = id && courseById(id);
    if (existing) {
      Object.assign(existing, data);
      toast("Course updated");
    } else {
      state.courses.push({ id: uid(), ...data });
      toast("Course added");
    }
    save();
    renderAll();
    closeModal($("#courseModal"));
  }

  function deleteCourse(id) {
    const c = courseById(id);
    if (!c) return;
    const taskCount = state.tasks.filter((t) => t.courseId === id).length;
    const sessionCount = state.sessions.filter((s) => s.courseId === id).length;
    confirmAction(
      `Delete “${c.name}”?`,
      `This will also delete ${taskCount} task${taskCount === 1 ? "" : "s"} and ${sessionCount} study session${sessionCount === 1 ? "" : "s"} for this course.`,
      () => {
        state.courses = state.courses.filter((x) => x.id !== id);
        state.tasks = state.tasks.filter((t) => t.courseId !== id);
        state.sessions = state.sessions.filter((s) => s.courseId !== id);
        save();
        renderAll();
        toast("Course deleted");
      }
    );
  }

  function saveTask(e) {
    e.preventDefault();
    const title = $("#taskTitle").value.trim();
    const due = $("#taskDue").value;
    if (!title) {
      $("#taskError").textContent = "Please enter a task title.";
      $("#taskTitle").focus();
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) {
      $("#taskError").textContent = "Please choose a valid due date.";
      $("#taskDue").focus();
      return;
    }
    const priorityInput = document.querySelector('input[name="priority"]:checked');
    const priority = priorityInput && PRIORITY_RANK[priorityInput.value] !== undefined ? priorityInput.value : "medium";
    const data = {
      title,
      courseId: $("#taskCourse").value,
      due,
      priority,
      notes: $("#taskNotes").value.trim(),
    };
    const id = $("#taskId").value;
    const existing = id && state.tasks.find((t) => t.id === id);
    if (existing) {
      Object.assign(existing, data);
      toast("Task updated");
    } else {
      state.tasks.push({ id: uid(), done: false, ...data });
      toast("Task added");
    }
    save();
    renderAll();
    closeModal($("#taskModal"));
  }

  function toggleTask(id, done) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = done;
    save();
    renderAll();
    toast(done ? "Nice work! Task completed" : "Task marked as pending");
  }

  function deleteTask(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    confirmAction(`Delete “${t.title}”?`, "This task will be permanently removed.", () => {
      state.tasks = state.tasks.filter((x) => x.id !== id);
      save();
      renderAll();
      toast("Task deleted");
    });
  }

  function clearCompleted() {
    const count = state.tasks.filter((t) => t.done).length;
    if (!count) {
      toast("No completed tasks to clear");
      return;
    }
    confirmAction("Clear completed tasks?", `${count} completed task${count === 1 ? "" : "s"} will be removed.`, () => {
      state.tasks = state.tasks.filter((t) => !t.done);
      save();
      renderAll();
      toast("Completed tasks cleared");
    });
  }

  function saveSession(e) {
    e.preventDefault();
    const start = $("#sessionStart").value;
    const end = $("#sessionEnd").value;
    const day = Number($("#sessionDay").value);
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      $("#sessionError").textContent = "Please enter a start and end time.";
      return;
    }
    if (minutes(end) <= minutes(start)) {
      $("#sessionError").textContent = "End time must be after the start time.";
      $("#sessionEnd").focus();
      return;
    }
    const data = {
      day: day >= 0 && day <= 6 ? day : 0,
      start,
      end,
      courseId: $("#sessionCourse").value,
      topic: $("#sessionTopic").value.trim(),
    };
    const id = $("#sessionId").value;
    const existing = id && state.sessions.find((s) => s.id === id);
    if (existing) {
      Object.assign(existing, data);
      toast("Study session updated");
    } else {
      state.sessions.push({ id: uid(), ...data });
      toast("Study session added");
    }
    save();
    renderAll();
    closeModal($("#sessionModal"));
  }

  function deleteSession(id) {
    const s = state.sessions.find((x) => x.id === id);
    if (!s) return;
    confirmAction("Delete this study session?", `${DAYS[s.day]}, ${formatTime(s.start)} – ${formatTime(s.end)}`, () => {
      state.sessions = state.sessions.filter((x) => x.id !== id);
      save();
      renderAll();
      toast("Study session deleted");
    });
  }

  // ---------- Events ----------
  function bindEvents() {
    $$(".nav-link").forEach((b) => b.addEventListener("click", () => showSection(b.dataset.section)));
    $$("[data-goto]").forEach((b) => b.addEventListener("click", () => showSection(b.dataset.goto)));
    $("#menuToggle").addEventListener("click", () => ($("#sidebar").classList.contains("open") ? closeMenu() : openMenu()));
    $("#overlay").addEventListener("click", closeMenu);

    $$("[data-open]").forEach((b) => b.addEventListener("click", () => {
      const type = b.dataset.open;
      if (type === "course") openCourseModal();
      if (type === "task") openTaskModal();
      if (type === "session") openSessionModal();
    }));

    $$("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal(b.closest("dialog"))));
    $$("dialog").forEach((d) => d.addEventListener("click", (e) => {
      if (e.target === d) closeModal(d);
    }));

    $("#courseForm").addEventListener("submit", saveCourse);
    $("#taskForm").addEventListener("submit", saveTask);
    $("#sessionForm").addEventListener("submit", saveSession);

    $("#courseColors").addEventListener("click", (e) => {
      const sw = e.target.closest(".swatch");
      if (!sw) return;
      ui.selectedColor = sw.dataset.color;
      renderSwatches();
    });

    $("#confirmOk").addEventListener("click", () => {
      const fn = pendingConfirm;
      pendingConfirm = null;
      closeModal($("#confirmModal"));
      if (fn) fn();
    });

    $("#editNameBtn").addEventListener("click", () => {
      $("#nameInput").value = state.name;
      openModal("nameModal");
    });
    $("#nameForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#nameInput").value.trim();
      if (!name) {
        $("#nameInput").focus();
        return;
      }
      state.name = name;
      save();
      renderDashboard();
      closeModal($("#nameModal"));
      toast("Name updated");
    });

    $("#resetDataBtn").addEventListener("click", () => {
      confirmAction("Reset to sample data?", "All your courses, tasks and study sessions will be replaced with the example data.", () => {
        seed();
        ui.statusFilter = "all";
        ui.courseFilter = "all";
        $$("#statusFilter .seg").forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));
        renderAll();
        closeMenu();
        toast("Sample data restored");
      });
    });

    // Delegated actions for dynamically rendered lists
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === "edit-course") openCourseModal(id);
      else if (action === "delete-course") deleteCourse(id);
      else if (action === "edit-task") openTaskModal(id);
      else if (action === "delete-task") deleteTask(id);
      else if (action === "edit-session") openSessionModal(id);
      else if (action === "delete-session") deleteSession(id);
      else if (action === "add-session") openSessionModal(null, Number(btn.dataset.day));
    });

    $("#taskList").addEventListener("change", (e) => {
      if (e.target.matches('input[data-action="toggle-task"]')) toggleTask(e.target.dataset.id, e.target.checked);
    });

    $("#statusFilter").addEventListener("click", (e) => {
      const b = e.target.closest(".seg");
      if (!b) return;
      ui.statusFilter = b.dataset.filter;
      $$("#statusFilter .seg").forEach((x) => x.classList.toggle("active", x === b));
      renderTasks();
    });
    $("#courseFilter").addEventListener("change", (e) => {
      ui.courseFilter = e.target.value;
      renderTasks();
    });
    $("#sortTasks").addEventListener("change", (e) => {
      ui.sort = e.target.value;
      renderTasks();
    });
    $("#clearCompletedBtn").addEventListener("click", clearCompleted);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    // Keep data in sync across browser tabs
    window.addEventListener("storage", (e) => {
      if (Object.values(KEYS).includes(e.key)) {
        load();
        renderAll();
      }
    });
  }

  // ---------- Init ----------
  function init() {
    $("#sessionDay").innerHTML = DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join("");
    load();
    bindEvents();
    renderAll();
    const initial = location.hash.slice(1);
    if (["dashboard", "courses", "tasks", "planner", "progress"].includes(initial)) showSection(initial);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
