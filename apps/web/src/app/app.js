const savedLocale = localStorage.getItem('mlprocour-locale');
const state = { customers: [], jobs: [], messages: [], automations: [], dashboard: null, conversation: null, mobileInboxMode: 'list', jobFilter: 'all', search: '', jobSearch: '', jobsSortOrder: 'newest', customersSortOrder: 'newest', calendarDate: new Date(), calendarView: 'month', locale: savedLocale === 'en' ? 'en' : 'fr', activeView: 'overview' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const t = (key, values = {}) => {
  const phrase = window.MLPROCOUR_LOCALES[state.locale][key] || window.MLPROCOUR_LOCALES.en[key] || key;
  return phrase.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
};

function applyTranslations() {
  document.documentElement.lang = state.locale === 'fr' ? 'fr-CA' : 'en-CA';
  document.title = t('documentTitle');
  const appTitle = $('meta[name="apple-mobile-web-app-title"]');
  if (appTitle) appTitle.content = t('appTitle');
  $$('[data-i18n]').forEach((element) => { element.textContent = t(element.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  $$('[data-i18n-aria]').forEach((element) => { element.setAttribute('aria-label', t(element.dataset.i18nAria)); });
  $$('[data-locale]').forEach((button) => {
    const selected = button.dataset.locale === state.locale;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('#overview-greeting').innerHTML = `${t(`greeting.${greetingPeriod()}`)}<span>.</span>`;
  $('#current-section').textContent = t(`nav.${state.activeView}`);
  renderSortControls();
  renderCalendar();
}

function greetingPeriod() {
  const hour = new Date().getHours();
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}

function localizedError(message) {
  const knownErrors = {
    'Add a phone number or email address.': 'error.contact',
    'Enter a valid email address.': 'error.email',
    'Name is required.': 'error.name',
    'Job title is required.': 'error.title',
    'Choose an existing customer.': 'error.customer',
    'Amount must be a non-negative number.': 'error.amount',
  };
  return t(knownErrors[message] || 'error.malformed');
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Something went wrong.');
  return result;
}

const customerFor = (id) => state.customers.find((customer) => customer.id === id);
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const avatarTone = (name) => ['tone-orange', '', 'tone-blue'][name.length % 3];
const money = (value) => value === null || value === undefined ? '—' : new Intl.NumberFormat(state.locale === 'fr' ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
const date = (value, options = { month: 'short', day: 'numeric' }) => value ? new Intl.DateTimeFormat(state.locale === 'fr' ? 'fr-CA' : 'en-CA', options).format(new Date(value)) : t('job.notScheduled');
const time = (value) => value ? new Intl.DateTimeFormat(state.locale === 'fr' ? 'fr-CA' : 'en-CA', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : t('job.notScheduled');
const ago = (value) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return state.locale === 'fr' ? 'à l’instant' : 'now';
  const unit = minutes < 60 ? 'minute' : minutes < 1440 ? 'hour' : 'day';
  const amount = unit === 'minute' ? minutes : unit === 'hour' ? Math.floor(minutes / 60) : Math.floor(minutes / 1440);
  return new Intl.RelativeTimeFormat(state.locale === 'fr' ? 'fr-CA' : 'en-CA', { numeric: 'auto', style: 'short' }).format(-amount, unit);
};
const label = (status) => t(`status.${status}`);

function renderSortControls() {
  for (const [view, orderKey, ariaKey] of [
    ['jobs', 'jobsSortOrder', 'sort.scheduledDate'],
    ['customers', 'customersSortOrder', 'sort.addedDate'],
  ]) {
    const direction = state[orderKey];
    $$(`[data-sort-date="${view}"]`).forEach((button) => {
      button.setAttribute('aria-label', `${t(ariaKey)}: ${t(`sort.${direction}`)}`);
      button.closest('th')?.setAttribute('aria-sort', direction === 'newest' ? 'descending' : 'ascending');
      $('[data-sort-indicator]', button).textContent = direction === 'newest' ? '↓' : '↑';
    });
  }
}

async function refresh() {
  const [dashboard, customerData, jobData, messageData, automationData] = await Promise.all([
    api('/api/dashboard'), api('/api/customers'), api('/api/jobs'), api('/api/messages'), api('/api/automations'),
  ]);
  state.customers = customerData.customers;
  state.jobs = jobData.jobs;
  state.messages = messageData.messages;
  state.automations = automationData.automations;
  state.dashboard = dashboard;
  renderDashboard(dashboard);
  renderCustomers();
  renderJobs();
  renderCalendar();
  renderInbox();
  renderAutomations();
  const select = $('#job-customer');
  const current = select.value;
  select.innerHTML = `<option value="">${t('jobDialog.chooseCustomer')}</option>` + state.customers.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
  if (state.customers.some((item) => item.id === current)) select.value = current;
}

function renderDashboard(data) {
  $('#metric-scheduled').textContent = data.counts.scheduledToday;
  $('#metric-active').textContent = data.counts.activeJobs;
  $('#metric-leads').textContent = data.counts.leads;
  $('#metric-customers').textContent = data.counts.customers;
  $('#nav-job-count').textContent = data.counts.activeJobs || '';
  $('#nav-inbox-count').textContent = data.counts.unreadMessages || '';
  const jobs = data.jobsToday.slice().sort((a, b) => (a.scheduledFor || '').localeCompare(b.scheduledFor || ''));
  $('#schedule-list').innerHTML = jobs.length ? jobs.map((job) => {
    const customer = customerFor(job.customerId);
    return `<article class="schedule-item"><time>${escapeHtml(time(job.scheduledFor))}</time><i class="schedule-marker status-${escapeHtml(job.status)}"></i><div><strong>${escapeHtml(job.title)}</strong><small>${escapeHtml(customer?.name || t('job.unknownCustomer'))} · ${escapeHtml(job.address || customer?.serviceAddress || t('job.addressMissing'))}</small></div><span>${escapeHtml(money(job.amount))}</span></article>`;
  }).join('') : `<p class="empty-state">${t('schedule.empty')}</p>`;
  $('#message-preview-list').innerHTML = data.recentMessages.length ? data.recentMessages.map((message) => {
    const customer = customerFor(message.customerId);
    return customer ? `<button class="message-preview" data-open-conversation="${escapeHtml(customer.id)}"><span class="avatar ${avatarTone(customer.name)}">${escapeHtml(initials(customer.name))}</span><span class="preview-copy"><span><strong>${escapeHtml(customer.name)}</strong><time>${escapeHtml(ago(message.createdAt))}</time></span><small>${message.direction === 'outbound' ? t('inbox.you') : ''}${escapeHtml(message.text)}</small></span></button>` : '';
  }).join('') : `<p class="empty-state">${t('messages.empty')}</p>`;
}

function renderCustomers() {
  const query = state.search.toLowerCase();
  const sortDirection = state.customersSortOrder === 'newest' ? -1 : 1;
  const customers = state.customers
    .filter((item) => [item.name, item.phone, item.email, item.serviceAddress].some((value) => (value || '').toLowerCase().includes(query)))
    .sort((left, right) => sortDirection * (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()));
  $('#customer-count').textContent = t(customers.length === 1 ? 'customers.count.one' : 'customers.count.other', { count: customers.length });
  $('#customers-table').innerHTML = customers.length ? customers.map((customer) => {
    const phone = customer.phone.replace(/[^\d+]/g, '');
    const contactActions = phone ? `<span class="contact-actions"><a class="action-link" data-action="call" href="tel:${escapeHtml(phone)}">${t('contact.call')}</a><a class="action-link" data-action="text" href="sms:${escapeHtml(phone)}">${t('contact.text')}</a></span>` : '';
    return `<tr><td data-column="customer" data-label="${t('table.customer')}"><span class="customer-cell"><span class="avatar ${avatarTone(customer.name)}">${escapeHtml(initials(customer.name))}</span><strong>${escapeHtml(customer.name)}</strong></span></td><td data-column="contact" data-label="${t('table.contact')}"><span class="cell-stack"><strong>${escapeHtml(customer.phone || t('contact.noPhone'))}</strong><small>${escapeHtml(customer.email || t('contact.noEmail'))}</small>${contactActions}</span></td><td data-column="address" data-label="${t('table.address')}">${escapeHtml(customer.serviceAddress || '—')}</td><td data-column="status" data-label="${t('table.status')}"><span class="status-pill status-${escapeHtml(customer.status)}">${escapeHtml(label(customer.status))}</span></td><td data-column="added" data-label="${t('table.added')}">${escapeHtml(date(customer.createdAt))}</td><td data-column="message" data-label="${t('table.message')}"><button class="row-action" data-open-conversation="${escapeHtml(customer.id)}" aria-label="${escapeHtml(t('customer.message', { name: customer.name }))}">···</button></td></tr>`;
  }).join('') : `<tr><td colspan="6"><p class="empty-state">${t('customers.empty')}</p></td></tr>`;
}

function renderJobs() {
  const query = state.jobSearch.trim().toLowerCase();
  const sortDirection = state.jobsSortOrder === 'newest' ? -1 : 1;
  const jobs = state.jobs
    .filter((job) => state.jobFilter === 'all' || job.status === state.jobFilter)
    .filter((job) => {
      const customer = customerFor(job.customerId);
      return !query || [job.title, customer?.name, job.address, customer?.serviceAddress]
        .some((value) => (value || '').toLowerCase().includes(query));
    })
    .sort((left, right) => {
      const leftHasDate = Boolean(left.scheduledFor);
      const rightHasDate = Boolean(right.scheduledFor);
      if (leftHasDate !== rightHasDate) return leftHasDate ? -1 : 1;
      const leftDate = new Date(left.scheduledFor || left.createdAt).getTime();
      const rightDate = new Date(right.scheduledFor || right.createdAt).getTime();
      return sortDirection * (leftDate - rightDate);
    });
  $('#jobs-table').innerHTML = jobs.length ? jobs.map((job) => {
    const customer = customerFor(job.customerId);
    const address = job.address || customer?.serviceAddress || '';
    const phone = customer?.phone.replace(/[^\d+]/g, '') || '';
    const actions = `${address ? `<a class="action-link" data-action="directions" href="https://maps.apple.com/?q=${encodeURIComponent(address)}">${t('contact.directions')}</a>` : ''}${phone ? `<a class="action-link" data-action="call" href="tel:${escapeHtml(phone)}">${t('contact.callCustomer')}</a>` : ''}`;
    return `<tr><td data-column="job" data-label="${t('table.job')}"><span class="cell-stack"><strong>${escapeHtml(job.title)}</strong><small>${escapeHtml(address || t('job.addressMissing'))}</small><span class="contact-actions">${actions}</span></span></td><td data-column="customer" data-label="${t('table.customer')}">${escapeHtml(customer?.name || t('job.unknownCustomer'))}</td><td data-column="when" data-label="${t('table.when')}">${escapeHtml(job.scheduledFor ? `${date(job.scheduledFor)} · ${time(job.scheduledFor)}` : t('job.notScheduled'))}</td><td data-column="status" data-label="${t('table.status')}"><label class="visually-hidden" for="status-${escapeHtml(job.id)}">${escapeHtml(t('job.changeStatus', { title: job.title }))}</label><select class="status-select status-${escapeHtml(job.status)}" id="status-${escapeHtml(job.id)}" data-job-status="${escapeHtml(job.id)}">${['estimate', 'scheduled', 'in_progress', 'complete'].map((value) => `<option value="${value}" ${job.status === value ? 'selected' : ''}>${label(value)}</option>`).join('')}</select></td><td data-column="value" data-label="${t('table.value')}" class="align-right">${escapeHtml(money(job.amount))}</td></tr>`;
  }).join('') : `<tr><td colspan="5"><p class="empty-state">${t('jobs.empty')}</p></td></tr>`;
}

function calendarKey(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calendarDateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function scheduledJobs() {
  return state.jobs
    .filter((job) => job.scheduledFor)
    .slice()
    .sort((left, right) => left.scheduledFor.localeCompare(right.scheduledFor));
}

function calendarEvent(job) {
  const customer = customerFor(job.customerId);
  return `<button class="calendar-event status-${escapeHtml(job.status)}" type="button" data-calendar-job="${escapeHtml(job.id)}"><time>${escapeHtml(time(job.scheduledFor))}</time><span>${escapeHtml(job.title)}</span><small>${escapeHtml(customer?.name || t('job.unknownCustomer'))}</small></button>`;
}

function renderCalendar() {
  const content = $('#calendar-content');
  if (!content) return;
  const locale = state.locale === 'fr' ? 'fr-CA' : 'en-CA';
  const selectedDate = state.calendarDate;
  const allScheduledJobs = scheduledJobs();
  const jobsByDate = new Map();
  for (const job of allScheduledJobs) {
    const key = job.scheduledFor.slice(0, 10);
    if (!jobsByDate.has(key)) jobsByDate.set(key, []);
    jobsByDate.get(key).push(job);
  }

  $$('.calendar-view-toggle [data-calendar-mode]').forEach((button) => {
    const selected = button.dataset.calendarMode === state.calendarView;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  const monthTitle = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(selectedDate);
  if (state.calendarView === 'week') {
    const weekdayOffset = (selectedDate.getDay() + 6) % 7;
    const weekStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - weekdayOffset);
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
    $('#calendar-period').textContent = `${date(weekStart, { month: 'short', day: 'numeric' })} – ${date(weekEnd, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    $('#calendar-weekdays').hidden = true;
    content.className = 'calendar-week-list';
    content.innerHTML = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index);
      const key = calendarKey(day);
      const jobs = jobsByDate.get(key) || [];
      const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(day);
      return `<section class="calendar-week-row ${key === calendarKey(new Date()) ? 'is-today' : ''}"><button class="calendar-week-date" type="button" data-calendar-day="${key}"><strong>${escapeHtml(weekday)}</strong><span>${escapeHtml(date(day, { month: 'short', day: 'numeric' }))}</span></button><div class="calendar-week-events">${jobs.length ? jobs.map(calendarEvent).join('') : `<span class="calendar-empty-day">${t('calendar.emptyDay')}</span>`}</div></section>`;
    }).join('');
    return;
  }

  if (state.calendarView === 'agenda') {
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
    $('#calendar-period').textContent = monthTitle;
    $('#calendar-weekdays').hidden = true;
    content.className = 'calendar-agenda-list';
    const monthJobs = allScheduledJobs.filter((job) => {
      const jobDate = calendarDateFromKey(job.scheduledFor.slice(0, 10));
      return jobDate >= monthStart && jobDate < monthEnd;
    });
    content.innerHTML = monthJobs.length ? monthJobs.map((job) => {
      const customer = customerFor(job.customerId);
      return `<button class="calendar-agenda-item status-${escapeHtml(job.status)}" type="button" data-calendar-job="${escapeHtml(job.id)}"><time><strong>${escapeHtml(date(job.scheduledFor, { weekday: 'short', day: 'numeric' }))}</strong><span>${escapeHtml(time(job.scheduledFor))}</span></time><span class="calendar-agenda-copy"><strong>${escapeHtml(job.title)}</strong><small>${escapeHtml(customer?.name || t('job.unknownCustomer'))} · ${escapeHtml(job.address || customer?.serviceAddress || t('job.addressMissing'))}</small></span><span class="calendar-agenda-value">${escapeHtml(money(job.amount))}</span></button>`;
    }).join('') : `<p class="calendar-empty-agenda">${t('calendar.emptyAgenda')}</p>`;
    return;
  }

  $('#calendar-period').textContent = monthTitle;
  $('#calendar-weekdays').hidden = false;
  content.className = 'calendar-month-grid';
  const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1 - offset);
  const weekdayStart = new Date(2024, 0, 1);
  $('#calendar-weekdays').innerHTML = Array.from({ length: 7 }, (_, index) => `<span>${escapeHtml(new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(weekdayStart.getFullYear(), weekdayStart.getMonth(), weekdayStart.getDate() + index)))}</span>`).join('');
  content.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const key = calendarKey(day);
    const sameMonth = day.getMonth() === selectedDate.getMonth();
    const jobs = jobsByDate.get(key) || [];
    return `<section class="calendar-day ${sameMonth ? '' : 'outside-month'} ${key === calendarKey(new Date()) ? 'is-today' : ''}"><button class="calendar-day-number" type="button" data-calendar-day="${key}" aria-label="${escapeHtml(date(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}">${day.getDate()}</button><div class="calendar-day-events">${jobs.map(calendarEvent).join('')}</div></section>`;
  }).join('');
}

function openCalendarJob(jobId) {
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job) return;
  const customer = customerFor(job.customerId);
  const address = job.address || customer?.serviceAddress || '';
  const phone = customer?.phone.replace(/[^\d+]/g, '') || '';
  $('#calendar-event-detail').innerHTML = `<div class="calendar-detail-heading"><div><p class="eyebrow" data-i18n="calendar.jobDetails">${t('calendar.jobDetails')}</p><h2 id="calendar-event-title">${escapeHtml(job.title)}</h2></div><button class="dialog-close" type="button" data-close-calendar aria-label="${escapeHtml(t('calendar.close'))}">×</button></div><div class="calendar-detail-meta"><span class="status-pill status-${escapeHtml(job.status)}">${escapeHtml(label(job.status))}</span><div><small>${t('calendar.date')}</small><strong>${escapeHtml(date(job.scheduledFor, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))} · ${escapeHtml(time(job.scheduledFor))}</strong></div><div><small>${t('calendar.client')}</small><strong>${escapeHtml(customer?.name || t('job.unknownCustomer'))}</strong></div>${address ? `<div><small>${t('calendar.address')}</small><strong>${escapeHtml(address)}</strong></div>` : ''}<div><small>${t('calendar.estimate')}</small><strong>${escapeHtml(money(job.amount))}</strong></div>${job.notes ? `<div><small>${t('calendar.notes')}</small><strong>${escapeHtml(job.notes)}</strong></div>` : ''}</div><div class="calendar-detail-actions">${address ? `<a class="action-link" data-action="directions" href="https://maps.apple.com/?q=${encodeURIComponent(address)}">${t('contact.directions')}</a>` : ''}${phone ? `<a class="action-link" data-action="call" href="tel:${escapeHtml(phone)}">${t('contact.callCustomer')}</a>` : ''}<button class="button quiet" type="button" data-open-job="${escapeHtml(job.id)}">${t('calendar.openJob')}</button></div>`;
  $('#calendar-event-dialog').showModal();
}

function groups() {
  const byCustomer = new Map();
  state.messages.forEach((message) => { if (!byCustomer.has(message.customerId)) byCustomer.set(message.customerId, []); byCustomer.get(message.customerId).push(message); });
  return [...byCustomer.entries()].map(([id, messages]) => ({ customer: customerFor(id), messages, latest: messages[messages.length - 1] })).filter((group) => group.customer).sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt));
}

function renderInbox() {
  const conversations = groups();
  const inboxWorkspace = $('.inbox-workspace');
  inboxWorkspace.classList.toggle('show-thread', state.mobileInboxMode === 'thread');
  if (!state.conversation && conversations.length) state.conversation = conversations[0].customer.id;
  $('#conversation-items').innerHTML = conversations.length ? conversations.map(({ customer, latest }) => `<button class="conversation-option ${state.conversation === customer.id ? 'selected' : ''}" data-select-conversation="${escapeHtml(customer.id)}"><span class="avatar ${avatarTone(customer.name)}">${escapeHtml(initials(customer.name))}</span><span class="preview-copy"><span><strong>${escapeHtml(customer.name)}</strong><time>${escapeHtml(ago(latest.createdAt))}</time></span><small>${latest.direction === 'outbound' ? t('inbox.you') : ''}${escapeHtml(latest.text)}</small></span></button>`).join('') : `<p class="empty-state">${t('inbox.emptyList')}</p>`;
  const thread = conversations.find((item) => item.customer.id === state.conversation);
  const customer = thread?.customer || customerFor(state.conversation);
  if (!customer) {
    $('#conversation-detail').innerHTML = `<div class="empty-inbox"><strong>${t('inbox.emptyTitle')}</strong><p>${t('inbox.emptyDetail')}</p></div>`;
    return;
  }
  $('#conversation-detail').innerHTML = `<header class="thread-header"><button class="mobile-inbox-back" type="button" data-inbox-back aria-label="${escapeHtml(t('inbox.back'))}">‹</button><span class="avatar ${avatarTone(customer.name)}">${escapeHtml(initials(customer.name))}</span><span><strong>${escapeHtml(customer.name)}</strong><small>${escapeHtml(customer.phone || customer.email || t('inbox.contactUnavailable'))}</small></span>${customer.phone ? `<a class="thread-call" href="tel:${escapeHtml(customer.phone.replace(/[^\d+]/g, ''))}" aria-label="${escapeHtml(t('inbox.call', { name: customer.name }))}">${t('contact.call')}</a>` : ''}</header><div class="thread-messages">${thread ? `<span class="thread-date">${escapeHtml(date(thread.latest.createdAt, { weekday: 'long', month: 'long', day: 'numeric' }))}</span>${thread.messages.map((message) => `<div class="bubble ${message.direction === 'outbound' ? 'outbound' : ''}">${escapeHtml(message.text)}<time>${escapeHtml(time(message.createdAt))}${message.automated ? escapeHtml(t('inbox.automatic')) : ''}</time></div>`).join('')}` : `<p class="empty-state">${t('inbox.noThread')}</p>`}</div><form class="thread-compose" id="message-form"><input name="text" maxlength="2000" placeholder="${escapeHtml(t('inbox.write'))}" aria-label="${escapeHtml(t('inbox.write'))}" required><button aria-label="${escapeHtml(t('inbox.send'))}">↑</button></form>`;
}

function renderAutomations() {
  const icons = ['↗', '◉', '◷'];
  const keys = {
    'instant-reply': ['automation.newInquiry.name', 'automation.newInquiry.description', 'automation.newInquiry.trigger'],
    'missed-call': ['automation.missedCall.name', 'automation.missedCall.description', 'automation.missedCall.trigger'],
    'appointment-reminder': ['automation.reminder.name', 'automation.reminder.description', 'automation.reminder.trigger'],
  };
  $('#automation-list').innerHTML = state.automations.map((item, index) => {
    const [nameKey, descriptionKey, triggerKey] = keys[item.id] || [];
    const name = nameKey ? t(nameKey) : item.name;
    return `<article class="automation-card"><span class="automation-icon">${icons[index % icons.length]}</span><div class="automation-copy"><h3>${escapeHtml(name)}</h3><p>${escapeHtml(descriptionKey ? t(descriptionKey) : item.description)}</p><small>${escapeHtml(triggerKey ? t(triggerKey) : item.trigger)}</small></div><button class="switch" role="switch" aria-checked="${item.enabled}" aria-label="${escapeHtml(t(item.enabled ? 'automation.toggle.disable' : 'automation.toggle.enable', { name }))}" data-toggle-automation="${escapeHtml(item.id)}"></button></article>`;
  }).join('');
  const replyRule = state.automations.find((item) => item.id === 'instant-reply');
  $('#auto-reply-state').textContent = t(replyRule?.enabled ? 'auto.ready' : 'auto.paused');
}

function navigate(name) {
  const views = ['overview', 'calendar', 'jobs', 'customers', 'inbox', 'automations'];
  const active = views.includes(name) ? name : 'overview';
  state.activeView = active;
  $$('.view').forEach((view) => view.classList.toggle('is-visible', view.id === `view-${active}`));
  $$('.nav-link').forEach((link) => link.classList.toggle('is-active', link.dataset.view === active));
  $$('.mobile-tabbar a').forEach((link) => {
    const selected = link.dataset.view === active;
    link.classList.toggle('is-active', selected);
    if (selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  $('#current-section').textContent = t(`nav.${active}`);
  history.replaceState(null, '', `#${active}`);
  $('.sidebar').classList.remove('open');
  if (active === 'calendar') renderCalendar();
}

let toastTimer;
function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 2600);
}

document.addEventListener('click', async (event) => {
  const target = event.target;
  const nav = target.closest('[data-view]');
  if (nav) { event.preventDefault(); navigate(nav.dataset.view); }
  const navigateButton = target.closest('[data-navigate]');
  if (navigateButton) navigate(navigateButton.dataset.navigate);
  const open = target.closest('[data-open-dialog]');
  if (open) { if (open.dataset.openDialog === 'job-dialog') $('#job-customer').value = ''; $(`#${open.dataset.openDialog}`).showModal(); }
  const close = target.closest('[data-close-dialog]');
  if (close) close.closest('dialog').close();
  if (target.closest('[data-close-calendar]')) $('#calendar-event-dialog').close();
  const localeButton = target.closest('[data-locale]');
  if (localeButton && localeButton.dataset.locale !== state.locale) {
    state.locale = localeButton.dataset.locale;
    localStorage.setItem('mlprocour-locale', state.locale);
    applyTranslations();
    if (state.dashboard) renderDashboard(state.dashboard);
    renderCustomers();
    renderJobs();
    renderCalendar();
    renderInbox();
    renderAutomations();
    const customerSelect = $('#job-customer');
    const selectedCustomer = customerSelect.value;
    customerSelect.innerHTML = `<option value="">${t('jobDialog.chooseCustomer')}</option>` + state.customers.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
    customerSelect.value = selectedCustomer;
  }
  const conversation = target.closest('[data-select-conversation], [data-open-conversation]');
  if (conversation) { state.conversation = conversation.dataset.selectConversation || conversation.dataset.openConversation; state.mobileInboxMode = 'thread'; navigate('inbox'); renderInbox(); }
  if (target.closest('[data-inbox-back]')) { state.mobileInboxMode = 'list'; renderInbox(); }
  const calendarMode = target.closest('[data-calendar-mode]');
  if (calendarMode) { state.calendarView = calendarMode.dataset.calendarMode; renderCalendar(); }
  const calendarShift = target.closest('[data-calendar-shift]');
  if (calendarShift) {
    const amount = Number(calendarShift.dataset.calendarShift);
    if (state.calendarView === 'week') {
      state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), state.calendarDate.getDate() + amount * 7);
    } else {
      const currentDay = state.calendarDate.getDate();
      const targetMonth = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + amount, 1);
      const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
      targetMonth.setDate(Math.min(currentDay, lastDay));
      state.calendarDate = targetMonth;
    }
    renderCalendar();
  }
  if (target.closest('[data-calendar-today]')) { state.calendarDate = new Date(); renderCalendar(); }
  const calendarEvent = target.closest('[data-calendar-job]');
  if (calendarEvent) openCalendarJob(calendarEvent.dataset.calendarJob);
  const calendarDay = target.closest('[data-calendar-day]');
  if (calendarDay) {
    state.calendarDate = calendarDateFromKey(calendarDay.dataset.calendarDay);
    renderCalendar();
    const scheduledInput = $('#job-form [name="scheduledFor"]');
    if (scheduledInput) scheduledInput.value = `${calendarDay.dataset.calendarDay}T09:00`;
    $('#job-dialog').showModal();
  }
  const openJob = target.closest('[data-open-job]');
  if (openJob) {
    const job = state.jobs.find((item) => item.id === openJob.dataset.openJob);
    $('#calendar-event-dialog').close();
    if (job) {
      state.jobSearch = job.title;
      $('#job-search').value = job.title;
      navigate('jobs');
      renderJobs();
    }
  }
  const filter = target.closest('[data-filter]');
  if (filter) { state.jobFilter = filter.dataset.filter; $$('.filter-tab').forEach((tab) => tab.classList.toggle('is-selected', tab === filter)); renderJobs(); }
  const sortButton = target.closest('[data-sort-date]');
  if (sortButton) {
    const orderKey = sortButton.dataset.sortDate === 'jobs' ? 'jobsSortOrder' : 'customersSortOrder';
    state[orderKey] = state[orderKey] === 'newest' ? 'oldest' : 'newest';
    renderSortControls();
    if (sortButton.dataset.sortDate === 'jobs') renderJobs();
    else renderCustomers();
  }
  const toggle = target.closest('[data-toggle-automation]');
  if (toggle) {
    const automation = state.automations.find((item) => item.id === toggle.dataset.toggleAutomation);
    try { await api(`/api/automations/${encodeURIComponent(automation.id)}`, { method: 'PATCH', body: JSON.stringify({ enabled: !automation.enabled }) }); automation.enabled = !automation.enabled; renderAutomations(); toast(t(automation.enabled ? 'toast.autoEnabled' : 'toast.autoDisabled', { name: t(({ 'instant-reply': 'automation.newInquiry.name', 'missed-call': 'automation.missedCall.name', 'appointment-reminder': 'automation.reminder.name' })[automation.id] || automation.name) })); }
    catch (error) { toast(localizedError(error.message)); }
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (form.id === 'customer-form' || form.id === 'job-form') {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    if (form.id === 'job-form' && payload.scheduledFor) payload.scheduledFor = new Date(payload.scheduledFor).toISOString();
    try { await api(form.id === 'customer-form' ? '/api/customers' : '/api/jobs', { method: 'POST', body: JSON.stringify(payload) }); form.closest('dialog').close(); form.reset(); $('.form-error', form).textContent = ''; await refresh(); toast(t(form.id === 'customer-form' ? 'toast.customerAdded' : 'toast.jobAdded')); }
    catch (error) { $('.form-error', form).textContent = localizedError(error.message); }
  }
  if (form.id === 'message-form') {
    event.preventDefault();
    try { await api('/api/messages', { method: 'POST', body: JSON.stringify({ customerId: state.conversation, text: new FormData(form).get('text'), direction: 'outbound', channel: 'sms' }) }); await refresh(); renderInbox(); }
    catch (error) { toast(localizedError(error.message)); }
  }
});

$('#customer-search').addEventListener('input', (event) => { state.search = event.target.value; renderCustomers(); });
$('#job-search').addEventListener('input', (event) => { state.jobSearch = event.target.value; renderJobs(); });
document.addEventListener('change', async (event) => {
  const select = event.target.closest('[data-job-status]');
  if (!select) return;
  try { await api(`/api/jobs/${encodeURIComponent(select.dataset.jobStatus)}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); await refresh(); toast(t('toast.jobUpdated')); }
  catch (error) { toast(localizedError(error.message)); }
});
$('.mobile-menu').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
navigator.serviceWorker?.register('/sw.js').catch(() => {});
const now = new Date();
$('#today-label').textContent = new Intl.DateTimeFormat(state.locale === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'short', month: 'short', day: 'numeric' }).format(now);
$('#greeting').textContent = new Intl.DateTimeFormat(state.locale === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', month: 'long', day: 'numeric' }).format(now).toUpperCase();
applyTranslations();
navigate(location.hash.slice(1));
refresh().catch((error) => toast(t('error.network', { message: error.message })));