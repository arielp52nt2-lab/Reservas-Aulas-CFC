"use strict";

const APP_VERSION = "1.0.0";
const STORAGE_KEY = "cfc-reservas-v1";
const ROOMS_BY_FLOOR = Object.freeze({
  "Piso 1": ["Atenea", "Hera"],
  "Piso 2": ["Platón", "Arheíste"],
  "Piso 3": ["Sócrates", "Leonardo da Vinci"],
  "Piso 4": ["Aristóteles"],
});

const state = {
  reservations: loadReservations(),
  weekStart: getStartOfWeek(new Date()),
  activeEmailId: null,
};

const elements = {
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
  form: document.querySelector("#reservation-form"),
  formTitle: document.querySelector("#form-title"),
  id: document.querySelector("#reservation-id"),
  date: document.querySelector("#date"),
  floor: document.querySelector("#floor"),
  room: document.querySelector("#room"),
  startTime: document.querySelector("#start-time"),
  endTime: document.querySelector("#end-time"),
  totalHours: document.querySelector("#total-hours"),
  responsible: document.querySelector("#responsible"),
  department: document.querySelector("#department"),
  topic: document.querySelector("#topic"),
  attendees: document.querySelector("#attendees"),
  facilitator: document.querySelector("#facilitator"),
  notes: document.querySelector("#notes"),
  availability: document.querySelector("#availability-message"),
  saveButton: document.querySelector("#save-reservation"),
  cancelEdit: document.querySelector("#cancel-edit"),
  weekLabel: document.querySelector("#week-label"),
  weekBoard: document.querySelector("#week-board"),
  calendarFloor: document.querySelector("#calendar-floor"),
  calendarRoom: document.querySelector("#calendar-room"),
  historyBody: document.querySelector("#history-body"),
  historyEmpty: document.querySelector("#history-empty"),
  historySearch: document.querySelector("#history-search"),
  historyFloor: document.querySelector("#history-floor"),
  historyPeriod: document.querySelector("#history-period"),
  summaryTotal: document.querySelector("#summary-total"),
  summaryUpcoming: document.querySelector("#summary-upcoming"),
  summaryWeek: document.querySelector("#summary-week"),
  emailEmpty: document.querySelector("#email-empty"),
  emailContent: document.querySelector("#email-content"),
  emailSubject: document.querySelector("#email-subject"),
  emailBody: document.querySelector("#email-body"),
  openEmail: document.querySelector("#open-email"),
  toast: document.querySelector("#toast"),
};

initialize();

function initialize() {
  setDefaultFormValues();
  bindEvents();
  populateRoomSelect(elements.calendarRoom, "");
  renderAll();
}

function bindEvents() {
  elements.tabs.forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.tab));
  });

  document.querySelector("#calendar-new").addEventListener("click", startNewReservation);
  document.querySelector("#history-new").addEventListener("click", startNewReservation);
  document.querySelector("#previous-week").addEventListener("click", () => changeWeek(-7));
  document.querySelector("#next-week").addEventListener("click", () => changeWeek(7));
  document.querySelector("#today-week").addEventListener("click", () => {
    state.weekStart = getStartOfWeek(new Date());
    renderCalendar();
  });

  elements.floor.addEventListener("change", () => {
    populateRoomSelect(elements.room, elements.floor.value, true);
    updateAvailability();
  });
  elements.date.addEventListener("change", updateAvailability);
  elements.room.addEventListener("change", updateAvailability);
  elements.startTime.addEventListener("input", updateTimeSummary);
  elements.endTime.addEventListener("input", updateTimeSummary);
  elements.form.addEventListener("submit", handleSubmit);
  elements.cancelEdit.addEventListener("click", resetForm);

  elements.calendarFloor.addEventListener("change", () => {
    populateRoomSelect(elements.calendarRoom, elements.calendarFloor.value);
    renderCalendar();
  });
  elements.calendarRoom.addEventListener("change", renderCalendar);

  elements.historySearch.addEventListener("input", renderHistory);
  elements.historyFloor.addEventListener("change", renderHistory);
  elements.historyPeriod.addEventListener("change", renderHistory);
  document.querySelector("#export-csv").addEventListener("click", exportCsv);
  document.querySelector("#copy-email").addEventListener("click", copyEmailMessage);
}

function loadReservations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidStoredReservation);
  } catch (error) {
    console.warn("No se pudo cargar el historial de reservas.", error);
    return [];
  }
}

function isValidStoredReservation(item) {
  return Boolean(
    item &&
      typeof item.id === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      ROOMS_BY_FLOOR[item.floor]?.includes(item.room) &&
      /^\d{2}:\d{2}$/.test(item.startTime) &&
      /^\d{2}:\d{2}$/.test(item.endTime),
  );
}

function saveReservations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.reservations));
}

function showView(name) {
  elements.tabs.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === name));
  elements.views.forEach((view) => view.classList.toggle("is-active", view.id === `${name}-view`));
  if (name === "calendar") renderCalendar();
  if (name === "history") renderHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startNewReservation() {
  resetForm();
  showView("form");
  requestAnimationFrame(() => elements.date.focus());
}

function setDefaultFormValues() {
  elements.date.value = formatDateKey(new Date());
  elements.startTime.value = "08:00";
  elements.endTime.value = "09:00";
  updateTimeSummary();
}

function resetForm() {
  elements.form.reset();
  elements.id.value = "";
  elements.formTitle.textContent = "Nueva reserva";
  elements.saveButton.textContent = "Guardar reserva";
  elements.cancelEdit.classList.add("is-hidden");
  elements.room.disabled = true;
  elements.room.innerHTML = '<option value="">Selecciona primero el piso</option>';
  clearFieldErrors();
  elements.availability.textContent = "";
  elements.availability.className = "availability-message";
  setDefaultFormValues();
}

function populateRoomSelect(select, floor, placeholderForForm = false) {
  const currentValue = select.value;
  const rooms = floor ? ROOMS_BY_FLOOR[floor] || [] : Object.values(ROOMS_BY_FLOOR).flat();
  const placeholder = placeholderForForm
    ? floor
      ? "Selecciona un aula"
      : "Selecciona primero el piso"
    : floor
      ? "Todas las aulas del piso"
      : "Todas las aulas";

  select.innerHTML = `<option value="">${placeholder}</option>`;
  rooms.forEach((room) => {
    const option = document.createElement("option");
    option.value = room;
    option.textContent = room;
    select.append(option);
  });
  select.disabled = placeholderForForm && !floor;
  if (rooms.includes(currentValue)) select.value = currentValue;
}

function updateTimeSummary() {
  const total = calculateHours(elements.startTime.value, elements.endTime.value);
  elements.totalHours.textContent = total === null ? "—" : formatHours(total);
  updateAvailability();
}

function calculateHours(start, end) {
  if (!start || !end) return null;
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (endMinutes <= startMinutes) return null;
  return (endMinutes - startMinutes) / 60;
}

function formatHours(hours) {
  const rounded = Math.round(hours * 100) / 100;
  return `${new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 }).format(rounded)} ${rounded === 1 ? "hora" : "horas"}`;
}

function updateAvailability() {
  const data = {
    id: elements.id.value,
    date: elements.date.value,
    room: elements.room.value,
    startTime: elements.startTime.value,
    endTime: elements.endTime.value,
  };
  elements.availability.className = "availability-message";
  if (!data.date || !data.room || calculateHours(data.startTime, data.endTime) === null) {
    elements.availability.textContent = "";
    return;
  }
  const conflict = findConflict(data);
  if (conflict) {
    elements.availability.textContent = `Horario ocupado por ${conflict.responsible}: ${conflict.startTime} a ${conflict.endTime}.`;
    elements.availability.classList.add("is-conflict");
  } else {
    elements.availability.textContent = "Aula disponible en este horario.";
    elements.availability.classList.add("is-available");
  }
}

function findConflict(candidate) {
  return state.reservations.find(
    (item) =>
      item.id !== candidate.id &&
      item.date === candidate.date &&
      item.room === candidate.room &&
      timeToMinutes(candidate.startTime) < timeToMinutes(item.endTime) &&
      timeToMinutes(candidate.endTime) > timeToMinutes(item.startTime),
  );
}

function handleSubmit(event) {
  event.preventDefault();
  clearFieldErrors();
  const data = collectFormData();
  if (!validateReservation(data)) return;

  const now = new Date().toISOString();
  const existingIndex = state.reservations.findIndex((item) => item.id === data.id);
  if (existingIndex >= 0) {
    data.createdAt = state.reservations[existingIndex].createdAt;
    data.updatedAt = now;
    state.reservations[existingIndex] = data;
  } else {
    data.id = createId();
    data.createdAt = now;
    data.updatedAt = now;
    state.reservations.push(data);
  }

  saveReservations();
  state.activeEmailId = data.id;
  renderAll();
  showEmailPanel(data.id);
  elements.id.value = data.id;
  elements.formTitle.textContent = "Editar reserva";
  elements.saveButton.textContent = "Guardar cambios";
  elements.cancelEdit.classList.remove("is-hidden");
  showToast(existingIndex >= 0 ? "Reserva actualizada correctamente." : "Reserva guardada correctamente.");
}

function collectFormData() {
  return {
    id: elements.id.value,
    date: elements.date.value,
    floor: elements.floor.value,
    room: elements.room.value,
    startTime: elements.startTime.value,
    endTime: elements.endTime.value,
    responsible: elements.responsible.value.trim(),
    department: elements.department.value.trim(),
    topic: elements.topic.value.trim(),
    attendees: Number(elements.attendees.value),
    facilitator: elements.facilitator.value.trim(),
    notes: elements.notes.value.trim(),
    appVersion: APP_VERSION,
  };
}

function validateReservation(data) {
  let valid = true;
  const required = [
    [elements.date, data.date, "Selecciona la fecha."],
    [elements.floor, data.floor, "Selecciona el piso."],
    [elements.room, data.room, "Selecciona el aula."],
    [elements.startTime, data.startTime, "Indica la hora de inicio."],
    [elements.endTime, data.endTime, "Indica la hora de fin."],
    [elements.responsible, data.responsible, "Indica el responsable."],
    [elements.department, data.department, "Indica el departamento o marca."],
    [elements.topic, data.topic, "Indica el tema o módulo."],
    [elements.attendees, data.attendees > 0, "Ingresa al menos un asistente."],
  ];

  required.forEach(([input, value, message]) => {
    if (!value) {
      setFieldError(input, message);
      valid = false;
    }
  });

  if (data.startTime && data.endTime && calculateHours(data.startTime, data.endTime) === null) {
    setFieldError(elements.endTime, "La hora de fin debe ser posterior a la hora de inicio.");
    valid = false;
  }

  const conflict = valid ? findConflict(data) : null;
  if (conflict) {
    setFieldError(elements.startTime, "Este horario se cruza con otra reserva.");
    setFieldError(elements.endTime, `${conflict.responsible}: ${conflict.startTime} a ${conflict.endTime}.`);
    elements.availability.textContent = `No se puede guardar: ${data.room} ya está reservada de ${conflict.startTime} a ${conflict.endTime}.`;
    elements.availability.className = "availability-message is-conflict";
    valid = false;
  }

  if (!valid) {
    elements.form.querySelector(".has-error input, .has-error select, .has-error textarea")?.focus();
    showToast("Revisa los campos señalados.");
  }
  return valid;
}

function setFieldError(input, message) {
  const field = input.closest(".field");
  if (!field) return;
  field.classList.add("has-error");
  const error = field.querySelector(".field-error");
  if (error) error.textContent = message;
}

function clearFieldErrors() {
  elements.form.querySelectorAll(".field").forEach((field) => field.classList.remove("has-error"));
  elements.form.querySelectorAll(".field-error").forEach((error) => (error.textContent = ""));
}

function editReservation(id) {
  const item = state.reservations.find((reservation) => reservation.id === id);
  if (!item) return;
  elements.id.value = item.id;
  elements.date.value = item.date;
  elements.floor.value = item.floor;
  populateRoomSelect(elements.room, item.floor, true);
  elements.room.value = item.room;
  elements.startTime.value = item.startTime;
  elements.endTime.value = item.endTime;
  elements.responsible.value = item.responsible;
  elements.department.value = item.department;
  elements.topic.value = item.topic;
  elements.attendees.value = item.attendees;
  elements.facilitator.value = item.facilitator || "";
  elements.notes.value = item.notes || "";
  elements.formTitle.textContent = "Editar reserva";
  elements.saveButton.textContent = "Guardar cambios";
  elements.cancelEdit.classList.remove("is-hidden");
  clearFieldErrors();
  updateTimeSummary();
  showEmailPanel(id);
  showView("form");
}

function deleteReservation(id) {
  const item = state.reservations.find((reservation) => reservation.id === id);
  if (!item) return;
  const confirmed = window.confirm(`¿Eliminar la reserva de ${item.room} del ${formatLongDate(item.date)}?`);
  if (!confirmed) return;
  state.reservations = state.reservations.filter((reservation) => reservation.id !== id);
  saveReservations();
  if (state.activeEmailId === id) hideEmailPanel();
  renderAll();
  showToast("Reserva eliminada.");
}

function renderAll() {
  state.reservations.sort(compareReservations);
  renderCalendar();
  renderHistory();
  renderSummary();
}

function renderCalendar() {
  const days = Array.from({ length: 7 }, (_, index) => addDays(state.weekStart, index));
  const weekEnd = days[6];
  elements.weekLabel.textContent = `${formatShortDate(days[0])} – ${formatShortDate(weekEnd)}`;
  elements.weekBoard.innerHTML = "";

  const selectedFloor = elements.calendarFloor.value;
  const selectedRoom = elements.calendarRoom.value;
  const todayKey = formatDateKey(new Date());

  days.forEach((date) => {
    const key = formatDateKey(date);
    const column = document.createElement("article");
    column.className = `day-column${key === todayKey ? " is-today" : ""}`;
    const items = state.reservations.filter(
      (item) =>
        item.date === key &&
        (!selectedFloor || item.floor === selectedFloor) &&
        (!selectedRoom || item.room === selectedRoom),
    );
    column.innerHTML = `
      <header class="day-header">
        <span class="day-name">${new Intl.DateTimeFormat("es-EC", { weekday: "short" }).format(date)}</span>
        <span class="day-number">${date.getDate()}</span>
      </header>
      <div class="day-reservations"></div>
    `;
    const list = column.querySelector(".day-reservations");
    if (!items.length) {
      list.innerHTML = '<p class="day-empty">Sin reservas</p>';
    } else {
      items.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "reservation-card";
        button.innerHTML = `
          <span>${escapeHtml(item.startTime)} – ${escapeHtml(item.endTime)}</span>
          <strong>${escapeHtml(item.room)}</strong>
          <small>${escapeHtml(item.topic)}</small>
          <small>${escapeHtml(item.responsible)}</small>
        `;
        button.addEventListener("click", () => editReservation(item.id));
        list.append(button);
      });
    }
    elements.weekBoard.append(column);
  });
  renderSummary();
}

function changeWeek(days) {
  state.weekStart = addDays(state.weekStart, days);
  renderCalendar();
}

function renderHistory() {
  const search = normalizeText(elements.historySearch.value);
  const floor = elements.historyFloor.value;
  const period = elements.historyPeriod.value;
  const todayKey = formatDateKey(new Date());
  const filtered = state.reservations.filter((item) => {
    const searchable = normalizeText(
      [item.responsible, item.department, item.topic, item.floor, item.room, item.facilitator].join(" "),
    );
    const matchesSearch = !search || searchable.includes(search);
    const matchesFloor = !floor || item.floor === floor;
    const matchesPeriod =
      period === "all" || (period === "upcoming" ? item.date >= todayKey : item.date < todayKey);
    return matchesSearch && matchesFloor && matchesPeriod;
  });

  elements.historyBody.innerHTML = "";
  elements.historyEmpty.classList.toggle("is-hidden", filtered.length > 0);
  filtered.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(formatCompactDate(item.date))}</strong></td>
      <td>${escapeHtml(item.startTime)} – ${escapeHtml(item.endTime)}<small>${escapeHtml(formatHours(calculateHours(item.startTime, item.endTime)))}</small></td>
      <td><strong>${escapeHtml(item.room)}</strong><small>${escapeHtml(item.floor)}</small></td>
      <td>${escapeHtml(item.responsible)}<small>${escapeHtml(item.department)}</small></td>
      <td>${escapeHtml(item.topic)}${item.facilitator ? `<small>Facilitador: ${escapeHtml(item.facilitator)}</small>` : ""}</td>
      <td>${Number(item.attendees)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="row-button" data-action="email">Correo</button>
          <button type="button" class="row-button" data-action="edit">Editar</button>
          <button type="button" class="row-button delete" data-action="delete">Eliminar</button>
        </div>
      </td>
    `;
    row.querySelector('[data-action="email"]').addEventListener("click", () => {
      showEmailPanel(item.id);
      showView("form");
    });
    row.querySelector('[data-action="edit"]').addEventListener("click", () => editReservation(item.id));
    row.querySelector('[data-action="delete"]').addEventListener("click", () => deleteReservation(item.id));
    elements.historyBody.append(row);
  });
}

function renderSummary() {
  const todayKey = formatDateKey(new Date());
  const weekEndKey = formatDateKey(addDays(state.weekStart, 6));
  const weekStartKey = formatDateKey(state.weekStart);
  elements.summaryTotal.textContent = String(state.reservations.length);
  elements.summaryUpcoming.textContent = String(state.reservations.filter((item) => item.date >= todayKey).length);
  elements.summaryWeek.textContent = String(
    state.reservations.filter((item) => item.date >= weekStartKey && item.date <= weekEndKey).length,
  );
}

function showEmailPanel(id) {
  const item = state.reservations.find((reservation) => reservation.id === id);
  if (!item) return;
  state.activeEmailId = id;
  const subject = `Reserva de aula | ${item.room} | ${formatCompactDate(item.date)}`;
  const body = buildEmailBody(item);
  elements.emailSubject.value = subject;
  elements.emailBody.value = body;
  elements.openEmail.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  elements.emailEmpty.classList.add("is-hidden");
  elements.emailContent.classList.remove("is-hidden");
}

function hideEmailPanel() {
  state.activeEmailId = null;
  elements.emailContent.classList.add("is-hidden");
  elements.emailEmpty.classList.remove("is-hidden");
}

function buildEmailBody(item) {
  const lines = [
    "Hola,",
    "",
    "Comparto los datos de la reserva de aula:",
    "",
    `Fecha: ${formatLongDate(item.date)}`,
    `Piso: ${item.floor}`,
    `Aula: ${item.room}`,
    `Horario: ${item.startTime} a ${item.endTime}`,
    `Total: ${formatHours(calculateHours(item.startTime, item.endTime))}`,
    `Responsable: ${item.responsible}`,
    `Departamento / marca: ${item.department}`,
    `Tema o módulo: ${item.topic}`,
    `Número de asistentes: ${item.attendees}`,
  ];
  if (item.facilitator) lines.push(`Facilitador: ${item.facilitator}`);
  if (item.notes) lines.push(`Observaciones: ${item.notes}`);
  lines.push("", "Saludos,", item.responsible);
  return lines.join("\n");
}

async function copyEmailMessage() {
  const text = `Asunto: ${elements.emailSubject.value}\n\n${elements.emailBody.value}`;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Mensaje copiado al portapapeles.");
  } catch {
    elements.emailBody.select();
    document.execCommand("copy");
    showToast("Mensaje copiado al portapapeles.");
  }
}

function exportCsv() {
  if (!state.reservations.length) {
    showToast("No hay reservas para descargar.");
    return;
  }
  const headers = [
    "Fecha",
    "Piso",
    "Aula",
    "Hora inicio",
    "Hora fin",
    "Total horas",
    "Responsable",
    "Departamento / marca",
    "Tema o módulo",
    "Asistentes",
    "Facilitador",
    "Observaciones",
  ];
  const rows = state.reservations.map((item) => [
    item.date,
    item.floor,
    item.room,
    item.startTime,
    item.endTime,
    calculateHours(item.startTime, item.endTime),
    item.responsible,
    item.department,
    item.topic,
    item.attendees,
    item.facilitator,
    item.notes,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `reservas-cfc-${formatDateKey(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Archivo CSV descargado.");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3000);
}

function compareReservations(a, b) {
  return `${a.date} ${a.startTime} ${a.room}`.localeCompare(`${b.date} ${b.startTime} ${b.room}`);
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `res-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function parseLocalDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongDate(dateKey) {
  return new Intl.DateTimeFormat("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseLocalDate(dateKey));
}

function formatCompactDate(dateKey) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseLocalDate(dateKey));
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function getStartOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
