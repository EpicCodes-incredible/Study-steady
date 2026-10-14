const STORAGE_KEY = 'study-steady-v1';
const app = document.querySelector('#app');
const taskDialog = document.querySelector('#task-dialog');
const timerDialog = document.querySelector('#timer-dialog');
const taskForm = document.querySelector('#task-form');
const toast = document.querySelector('#toast');

let view = 'today';
let assignmentFilter = 'active';
let toastTimeout;
let timerInterval = null;
let timerRemaining = 25 * 60;
let timerMode = 'focus';
let timerTaskId = null;

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function tomorrowKey() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return todayKey(date);
}

function defaultData() {
  return { tasks: [], plans: {} };
}

function loadData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && Array.isArray(parsed.tasks) && parsed.plans && typeof parsed.plans === 'object') {
      return parsed;
    }
  } catch (error) {
    console.warn('Study Steady could not read the saved plan.', error);
  }
  return defaultData();
}

const data = loadData();

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    showToast('This browser could not save your plan. Check its storage settings.');
    console.warn('Study Steady could not save the plan.', error);
  }
}

function getPlan(day = todayKey()) {
  if (!data.plans[day]) {
    data.plans[day] = { priorityIds: [], energy: 'steady', breaksTaken: 0, focusSessions: 0, reviewed: false };
  }
  const plan = data.plans[day];
  if (!Array.isArray(plan.priorityIds)) plan.priorityIds = [];
  if (!plan.energy) plan.energy = 'steady';
  if (!Number.isFinite(plan.breaksTaken)) plan.breaksTaken = 0;
  if (!Number.isFinite(plan.focusSessions)) plan.focusSessions = 0;
  return plan;
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
}

function formatDueDate(value) {
  if (!value) return 'No deadline';
  const [year, month, day] = value.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const target = todayKey(due);
  const today = todayKey();
  const tomorrow = tomorrowKey();
  if (target === today) return 'Due today';
  if (target === tomorrow) return 'Due tomorrow';
  if (target < today) return 'Past due';
  return `Due ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(due)}`;
}

function isDueSoon(value) {
  if (!value) return false;
  const [year, month, day] = value.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const delta = Math.round((due - new Date(`${todayKey()}T00:00:00`)) / 86400000);
  return delta <= 1;
}

function sortedTasks(tasks = data.tasks) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && !b.dueDate) return -1;
    if (a.dueDate !== b.dueDate) return (a.dueDate || '').localeCompare(b.dueDate || '');
    return b.createdAt - a.createdAt;
  });
}

function getTask(id) {
  return data.tasks.find((task) => task.id === id);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function updateNavigation() {
  document.querySelectorAll('.nav-link').forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

function render() {
  updateNavigation();
  if (view === 'assignments') app.innerHTML = renderAssignments();
  else if (view === 'review') app.innerHTML = renderReview();
  else app.innerHTML = renderToday();
}

function renderToday() {
  const plan = getPlan();
  const priorities = plan.priorityIds.map(getTask).filter(Boolean);
  const completedPriorities = priorities.filter((task) => task.completed).length;
  const activeTasks = sortedTasks(data.tasks.filter((task) => !task.completed));
  const dueSoonCount = activeTasks.filter((task) => task.dueDate && isDueSoon(task.dueDate)).length;
  const activeCount = activeTasks.length;
  const energy = plan.energy;
  const energyLabels = { low: 'Taking it gently', steady: 'Finding your pace', high: 'Feeling energized' };

  return `
    <section class="today-hero">
      <div class="today-hero-copy">
        <span class="eyebrow">${escapeHTML(formatLongDate())} <span aria-hidden="true">·</span> a fresh page</span>
        <h1>Make room for what matters.</h1>
        <p>A good study day has focus, a little breathing room, and a finish line.</p>
      </div>
      <div class="hero-actions">
        <button class="button button-quiet" type="button" data-action="open-review">Close out today <span aria-hidden="true">↗</span></button>
        <button class="button button-primary" type="button" data-action="add-task"><span aria-hidden="true">＋</span> Add assignment</button>
      </div>
    </section>

    <section class="stat-strip" aria-label="Today's progress">
      <div class="stat-card"><span class="stat-icon">✳</span><div class="stat-copy"><strong>${completedPriorities}/${priorities.length}</strong><span>priorities moved forward</span></div></div>
      <div class="stat-card"><span class="stat-icon coral">◷</span><div class="stat-copy"><strong>${plan.focusSessions}</strong><span>focus sessions today</span></div></div>
      <div class="stat-card"><span class="stat-icon lime">☼</span><div class="stat-copy"><strong>${plan.breaksTaken}</strong><span>little resets taken</span></div></div>
    </section>

    <section class="today-grid">
      <article class="panel priority-panel">
        <div class="panel-heading">
          <div><span class="eyebrow">Your north stars</span><h2>Today's priorities</h2></div>
          <span class="priority-count">${priorities.length} of 3 chosen</span>
        </div>
        ${priorities.length ? `<ol class="priority-list">${priorities.map((task, index) => renderPriorityItem(task, index)).join('')}</ol>` : `
          <div class="empty-state">
            <span class="empty-illustration" aria-hidden="true">✳</span>
            <h3>Choose what deserves your attention</h3>
            <p>Pick up to three assignments to move forward today. Small progress still counts.</p>
            <button class="button button-soft button-small" type="button" data-action="add-task">Add your first assignment <span aria-hidden="true">↗</span></button>
          </div>`}
      </article>

      <aside class="panel rhythm-panel">
        <span class="eyebrow">Make a little space</span>
        <h2>${escapeHTML(energyLabels[energy] || energyLabels.steady)}</h2>
        <p class="rhythm-copy">Choose a pace that fits your energy today. Your plan can change with you.</p>
        <div class="energy-label">How's your energy?</div>
        <div class="energy-options" role="group" aria-label="Choose your energy level">
          ${[['low', 'Low'], ['steady', 'Steady'], ['high', 'High']].map(([value, label]) => `<button type="button" class="energy-option ${energy === value ? 'is-selected' : ''}" data-action="set-energy" data-energy="${value}" aria-pressed="${energy === value}">${label}</button>`).join('')}
        </div>
        <div class="rhythm-divider"></div>
        <div class="rhythm-bottom">
          <div class="rhythm-bottom-copy"><strong>Rest belongs in the plan.</strong><span>A five-minute reset is ready when you are.</span></div>
          <span class="break-count" aria-label="${plan.breaksTaken} breaks taken">${plan.breaksTaken}</span>
        </div>
        <button class="button button-coral button-small" type="button" data-action="start-break" style="position:relative;z-index:1;margin-top:13px">Take a 5-minute break <span aria-hidden="true">↗</span></button>
      </aside>
    </section>

    <section class="panel secondary-section">
      <div class="panel-heading">
        <div><span class="eyebrow">One step at a time</span><h2>On your plate</h2><p class="section-subtitle">${activeCount ? `${activeCount} active assignment${activeCount === 1 ? '' : 's'}${dueSoonCount ? ` · ${dueSoonCount} due soon` : ''}` : 'Add a task when you’re ready.'}</p></div>
        ${activeCount ? `<button class="button button-quiet button-small" type="button" data-view="assignments">View all <span aria-hidden="true">↗</span></button>` : ''}
      </div>
      <div class="compact-task-list">${activeTasks.length ? activeTasks.slice(0, 4).map(renderCompactTask).join('') : `
        <div class="empty-state" style="min-height:145px;padding-bottom:12px">
          <span class="empty-illustration" aria-hidden="true">☁</span><h3>Your list can start small</h3>
          <p>Add one assignment and give it a next step. You can plan the rest later.</p>
          <button class="button button-soft button-small" type="button" data-action="add-task">Add an assignment</button>
        </div>`}</div>
    </section>`;
}

function renderPriorityItem(task, index) {
  const due = task.dueDate ? `<span class="meta-dot"></span><span>${escapeHTML(formatDueDate(task.dueDate))}</span>` : '';
  return `<li class="priority-item ${task.completed ? 'is-done' : ''}">
    <span class="priority-number">${String(index + 1).padStart(2, '0')}</span>
    <div><div class="task-title">${escapeHTML(task.title)}</div>${task.nextStep ? `<span class="task-next-step">First step: ${escapeHTML(task.nextStep)}</span>` : ''}<div class="task-meta">${task.course ? `<span class="course-tag">${escapeHTML(task.course)}</span>` : ''}${task.course && due ? '<span class="meta-dot"></span>' : ''}<span>${task.minutes} min</span>${due}</div></div>
    <div class="priority-actions">
      ${task.completed ? '<span class="due-pill">Done</span>' : `<button class="button button-soft button-small" type="button" data-action="start-focus" data-id="${task.id}">Focus <span aria-hidden="true">↗</span></button>`}
      <button class="mini-action ${task.completed ? 'done-action' : ''}" type="button" data-action="complete-task" data-id="${task.id}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}">${task.completed ? '✓' : '○'}</button>
    </div>
  </li>`;
}

function renderCompactTask(task) {
  return `<div class="compact-task">
    <button class="task-check ${task.completed ? 'is-checked' : ''}" type="button" data-action="complete-task" data-id="${task.id}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}">✓</button>
    <div class="compact-task-body"><span class="task-title">${escapeHTML(task.title)}</span>${task.nextStep ? `<span class="task-next-step">First: ${escapeHTML(task.nextStep)}</span>` : ''}<div class="task-meta">${task.course ? `<span class="course-tag">${escapeHTML(task.course)}</span><span class="meta-dot"></span>` : ''}<span>${task.minutes} min</span></div></div>
    <div class="compact-task-actions"><span class="due-pill ${task.dueDate && isDueSoon(task.dueDate) ? 'due-soon' : ''}">${escapeHTML(formatDueDate(task.dueDate))}</span><button class="mini-action" type="button" data-action="start-focus" data-id="${task.id}" aria-label="Start focus session">▶</button></div>
  </div>`;
}

function renderTaskRow(task) {
  const due = formatDueDate(task.dueDate);
  return `<div class="task-row ${task.completed ? 'is-complete' : ''}">
    <button class="task-check ${task.completed ? 'is-checked' : ''}" type="button" data-action="complete-task" data-id="${task.id}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}">✓</button>
    <div class="task-row-main"><div class="task-row-title"><span class="task-title">${escapeHTML(task.title)}</span>${task.course ? `<span class="course-tag">${escapeHTML(task.course)}</span>` : ''}</div>${task.nextStep ? `<span class="task-next-step">First step: ${escapeHTML(task.nextStep)}</span>` : ''}<div class="task-meta"><span>${task.minutes} min</span><span class="meta-dot"></span><span>${escapeHTML(due)}</span></div></div>
    <div class="task-row-actions">
      ${task.completed ? '' : `<button class="button button-soft button-small" type="button" data-action="start-focus" data-id="${task.id}">Focus</button>`}
      <button class="mini-action" type="button" data-action="toggle-priority" data-id="${task.id}" aria-label="${getPlan().priorityIds.includes(task.id) ? 'Remove from priorities' : 'Add to priorities'}" title="${getPlan().priorityIds.includes(task.id) ? 'Remove from today’s priorities' : 'Add to today’s priorities'}">${getPlan().priorityIds.includes(task.id) ? '✳' : '＋'}</button>
      <button class="mini-action" type="button" data-action="delete-task" data-id="${task.id}" aria-label="Delete assignment" title="Delete assignment">×</button>
    </div>
  </div>`;
}

function renderAssignments() {
  const filters = [
    ['active', 'In progress'], ['all', 'All assignments'], ['completed', 'Completed']
  ];
  const tasks = sortedTasks(data.tasks.filter((task) => {
    if (assignmentFilter === 'active') return !task.completed;
    if (assignmentFilter === 'completed') return task.completed;
    return true;
  }));
  return `<section class="view-heading">
      <div><span class="eyebrow">A place for the moving pieces</span><h1>Assignments</h1><p>Break big work into small, startable steps.</p></div>
      <button class="button button-primary" type="button" data-action="add-task"><span aria-hidden="true">＋</span> Add assignment</button>
    </section>
    <section class="panel assignments-panel">
      <div class="panel-heading"><div><span class="eyebrow">Your list</span><h2>${data.tasks.length} assignment${data.tasks.length === 1 ? '' : 's'}</h2></div></div>
      <div class="filter-row" role="group" aria-label="Filter assignments">${filters.map(([value, label]) => `<button class="filter-button ${assignmentFilter === value ? 'is-active' : ''}" type="button" data-action="set-filter" data-filter="${value}" aria-pressed="${assignmentFilter === value}">${label}</button>`).join('')}</div>
      ${tasks.length ? `<div>${tasks.map(renderTaskRow).join('')}</div>` : `<div class="empty-state assignment-empty"><span class="empty-illustration" aria-hidden="true">✎</span><h3>${assignmentFilter === 'completed' ? 'Nothing checked off just yet' : 'Your list is clear'}</h3><p>${assignmentFilter === 'completed' ? 'When you finish a task, you’ll find it here.' : 'Add an assignment when you’re ready. Then choose one small next step.'}</p>${assignmentFilter !== 'completed' ? '<button class="button button-soft button-small" type="button" data-action="add-task">Add an assignment</button>' : ''}</div>`}
    </section>`;
}

function renderReview() {
  const plan = getPlan();
  const priorities = plan.priorityIds.map(getTask).filter(Boolean);
  const done = data.tasks.filter((task) => task.completed && task.completedOn === todayKey()).length;
  const selectedDone = priorities.filter((task) => task.completed).length;
  const unfinished = priorities.filter((task) => !task.completed);
  return `<section class="view-heading">
      <div><span class="eyebrow">A gentle landing</span><h1>Daily review</h1><p>${escapeHTML(formatLongDate())} · Notice what moved forward, then let the rest wait.</p></div>
    </section>
    <section class="review-grid">
      <article class="panel review-main">
        <span class="eyebrow">You showed up today</span><h2>Progress is more than a perfect checklist.</h2><p>Take a moment to notice what you gave your attention to.</p>
        <div class="review-summary">
          <div class="review-metric"><strong>${done}</strong><span>tasks completed today</span></div>
          <div class="review-metric"><strong>${plan.focusSessions}</strong><span>focus sessions</span></div>
          <div class="review-metric"><strong>${plan.breaksTaken}</strong><span>little resets</span></div>
        </div>
        <h3>Today's priorities</h3>
        ${priorities.length ? `<div class="review-priority-list">${priorities.map((task, index) => `<div class="review-priority-row ${task.completed ? 'is-done' : ''}"><span class="priority-number">${String(index + 1).padStart(2, '0')}</span><span>${escapeHTML(task.title)}</span></div>`).join('')}</div>` : `<p class="muted" style="font-size:11px;margin:0 0 20px">You didn’t set priorities today. Tomorrow is another chance to choose what matters.</p>`}
        <div class="review-actions">
          ${unfinished.length ? `<button class="button button-soft" type="button" data-action="carry-over">Carry unfinished to tomorrow <span aria-hidden="true">↗</span></button>` : ''}
          <button class="button button-primary" type="button" data-action="save-review">${plan.reviewed ? 'Review saved ✓' : 'Save today’s review'}</button>
        </div>
      </article>
      <aside class="panel review-side">
        <div><span class="eyebrow">Your reset counts too</span><h2>Let your brain have a breather.</h2><p>A short pause can help you come back with a little more room to think.</p></div>
        <div class="rest-art" aria-hidden="true">☼</div>
        <button class="button button-coral" type="button" data-action="start-break">Take a 5-minute break <span aria-hidden="true">↗</span></button>
      </aside>
    </section>`;
}

function openTaskDialog() {
  taskForm.reset();
  const dueInput = taskForm.elements.dueDate;
  dueInput.min = todayKey();
  taskDialog.showModal();
  requestAnimationFrame(() => taskForm.elements.title.focus());
}

function addTask(formData) {
  const title = String(formData.get('title') || '').trim();
  if (!title) return;
  const task = {
    id: crypto.randomUUID ? crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    nextStep: String(formData.get('nextStep') || '').trim(),
    course: String(formData.get('course') || '').trim(),
    dueDate: String(formData.get('dueDate') || ''),
    minutes: Number(formData.get('minutes')) || 25,
    completed: false,
    createdAt: Date.now(),
    completedOn: null
  };
  data.tasks.push(task);
  const makePriority = formData.get('priority') === 'on';
  if (makePriority) addPriority(task.id, false);
  saveData();
  render();
  taskDialog.close();
  if (makePriority && !getPlan().priorityIds.includes(task.id)) showToast('Assignment added. Today already has three priorities; remove one to make room.');
  else showToast(makePriority ? 'Assignment added to today’s priorities.' : 'Assignment added. One step at a time.');
}

function addPriority(id, notify = true) {
  const ids = getPlan().priorityIds;
  if (ids.includes(id)) return true;
  if (ids.length >= 3) {
    if (notify) showToast('You’ve chosen three priorities. Finish or remove one to make room.');
    return false;
  }
  ids.push(id);
  return true;
}

function togglePriority(id) {
  const plan = getPlan();
  if (plan.priorityIds.includes(id)) plan.priorityIds = plan.priorityIds.filter((item) => item !== id);
  else if (!addPriority(id)) return;
  saveData();
  render();
}

function toggleComplete(id) {
  const task = getTask(id);
  if (!task) return;
  task.completed = !task.completed;
  task.completedOn = task.completed ? todayKey() : null;
  saveData();
  render();
  showToast(task.completed ? 'Nice work. That step is done.' : 'Back on your list.');
}

function deleteTask(id) {
  data.tasks = data.tasks.filter((task) => task.id !== id);
  Object.values(data.plans).forEach((plan) => {
    plan.priorityIds = (plan.priorityIds || []).filter((taskId) => taskId !== id);
  });
  saveData();
  render();
  showToast('Assignment removed.');
}

function openTimer(mode = 'focus', taskId = null) {
  timerTaskId = taskId;
  setTimerMode(mode, true);
  timerDialog.showModal();
}

function setTimerMode(mode, reset = false) {
  timerMode = mode;
  if (reset || timerInterval === null) timerRemaining = (mode === 'break' ? 5 : 25) * 60;
  document.querySelectorAll('[data-timer-mode]').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.timerMode === mode);
  });
  const task = timerTaskId ? getTask(timerTaskId) : null;
  document.querySelector('#timer-eyebrow').textContent = mode === 'break' ? 'A little room to breathe' : 'A little focus time';
  document.querySelector('#timer-task').textContent = mode === 'break' ? 'Let your mind wander for a moment.' : (task?.title || 'One thing at a time.');
  document.querySelector('#timer-message').textContent = mode === 'break' ? 'Stretch, sip some water, or just look away from the screen.' : 'Settle in. You can pause whenever you need.';
  document.querySelector('#timer-toggle').textContent = mode === 'break' ? 'Start break' : 'Start focus';
  document.querySelector('#timer-reset').textContent = 'Start over';
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerRemaining / 60).toString().padStart(2, '0');
  const seconds = (timerRemaining % 60).toString().padStart(2, '0');
  document.querySelector('#timer-display').textContent = `${minutes}:${seconds}`;
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  const button = document.querySelector('#timer-toggle');
  button.textContent = timerMode === 'break' ? 'Start break' : 'Start focus';
}

function startTimer() {
  if (timerRemaining <= 0) timerRemaining = (timerMode === 'break' ? 5 : 25) * 60;
  document.querySelector('#timer-toggle').textContent = 'Pause';
  document.querySelector('#timer-message').textContent = timerMode === 'break' ? 'No need to earn this pause.' : 'You’re here. One small step is enough.';
  timerInterval = setInterval(() => {
    timerRemaining -= 1;
    updateTimerDisplay();
    if (timerRemaining <= 0) finishTimer();
  }, 1000);
}

function finishTimer() {
  stopTimer();
  timerRemaining = 0;
  updateTimerDisplay();
  const plan = getPlan();
  if (timerMode === 'break') plan.breaksTaken += 1;
  else plan.focusSessions += 1;
  saveData();
  document.querySelector('#timer-message').textContent = timerMode === 'break' ? 'That pause was part of your progress.' : 'Your focus session is complete. Take a breath.';
  document.querySelector('#timer-toggle').textContent = 'Done';
  render();
  showToast(timerMode === 'break' ? 'Break complete. Welcome back when you’re ready.' : 'Focus session complete. You made space for the work.');
}

function carryOver() {
  const unfinished = getPlan().priorityIds.filter((id) => {
    const task = getTask(id);
    return task && !task.completed;
  });
  const next = getPlan(tomorrowKey());
  let moved = 0;
  unfinished.forEach((id) => {
    if (!next.priorityIds.includes(id) && next.priorityIds.length < 3) {
      next.priorityIds.push(id);
      moved += 1;
    }
  });
  saveData();
  showToast(moved ? (moved === 1 ? '1 unfinished priority saved for tomorrow.' : `${moved} unfinished priorities saved for tomorrow.`) : 'No new priorities added. Your assignments are still on your list.');
}

document.addEventListener('click', (event) => {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) {
    view = viewButton.dataset.view;
    render();
    return;
  }

  const closeButton = event.target.closest('[data-close]');
  if (closeButton) {
    document.getElementById(closeButton.dataset.close).close();
    return;
  }

  const modeButton = event.target.closest('[data-timer-mode]');
  if (modeButton) {
    stopTimer();
    setTimerMode(modeButton.dataset.timerMode, true);
    return;
  }

  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === 'add-task') openTaskDialog();
  else if (action === 'open-review') { view = 'review'; render(); }
  else if (action === 'complete-task') toggleComplete(id);
  else if (action === 'toggle-priority') togglePriority(id);
  else if (action === 'delete-task') deleteTask(id);
  else if (action === 'start-focus') openTimer('focus', id);
  else if (action === 'start-break') openTimer('break');
  else if (action === 'set-filter') { assignmentFilter = button.dataset.filter; render(); }
  else if (action === 'set-energy') { getPlan().energy = button.dataset.energy; saveData(); render(); }
  else if (action === 'carry-over') carryOver();
  else if (action === 'save-review') { getPlan().reviewed = true; saveData(); render(); showToast('Today’s review is saved. You can let the day go.'); }
});

taskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addTask(new FormData(taskForm));
});

document.querySelector('#timer-toggle').addEventListener('click', () => {
  if (timerRemaining === 0) {
    timerDialog.close();
    return;
  }
  if (timerInterval) {
    stopTimer();
    document.querySelector('#timer-message').textContent = 'Paused. Come back when you’re ready.';
  } else startTimer();
});

document.querySelector('#timer-reset').addEventListener('click', () => {
  stopTimer();
  timerRemaining = (timerMode === 'break' ? 5 : 25) * 60;
  document.querySelector('#timer-message').textContent = timerMode === 'break' ? 'A short pause, just for you.' : 'Settle in. You can pause whenever you need.';
  updateTimerDisplay();
});

timerDialog.addEventListener('close', stopTimer);
taskDialog.addEventListener('click', (event) => {
  if (event.target === taskDialog) taskDialog.close();
});
timerDialog.addEventListener('click', (event) => {
  if (event.target === timerDialog) timerDialog.close();
});

render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Offline support could not be enabled.', error));
  });
}
