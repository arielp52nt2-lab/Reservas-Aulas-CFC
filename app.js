"use strict";

const APP_VERSION = "2.1.0";
const STORAGE_KEY = "cfc-reservas-v1";
const SHARED_MIGRATION_KEY = "cfc-reservas-shared-migration-v1";
const API_ENDPOINT = "/api/reservations";
const SYNC_INTERVAL_MS = 4000;
const MAX_RESERVATION_DAYS = 7;
const ROOM_CATALOG = Object.freeze({
  "Piso 1": [
    { name: "Atenea", type: "Centro de cómputo", capacity: 24 },
    { name: "Manuela Sáenz", type: "Sala de capacitación", capacity: 60 },
  ],
  "Piso 2": [
    { name: "Albert Einstein", type: "Sala de capacitación", capacity: 40 },
    { name: "Platón", type: "Sala de meditación", capacity: 25 },
  ],
  "Piso 3": [
    { name: "Sócrates", type: "Sala de conferencias", capacity: 12 },
    { name: "Leonardo da Vinci", type: "Sala multiuso", capacity: 25 },
  ],
  "Piso 4": [{ name: "Aristóteles", type: "Auditorio", capacity: 105 }],
});
const ROOMS_BY_FLOOR = Object.freeze(
  Object.fromEntries(Object.entries(ROOM_CATALOG).map(([floor, rooms]) => [floor, rooms.map((room) => room.name)])),
);
const LEGACY_ROOM_NAMES = Object.freeze({
  Hera: "Manuela Sáenz",
  Arheíste: "Albert Einstein",
});

const state = {
  reservations: loadReservations(),
  weekStart: getStartOfWeek(new Date()),
  monthDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12),
  activeEmailId: null,
  syncInProgress: false,
};

const elements = {
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
  form: document.querySelector("#reservation-form"),
  formTitle: document.querySelector("#form-title"),
  id: document.querySelector("#reservation-id"),
  date: document.querySelector("#date"),
  endDate: document.querySelector("#end-date"),
  floor: document.querySelector("#floor"),
  room: document.querySelector("#room"),
  roomDetails: document.querySelector("#room-details"),
  startTime: document.querySelector("#start-time"),
  endTime: document.querySelector("#end-time"),
  totalHours: document.querySelector("#total-hours"),
  responsible: document.querySelector("#responsible"),
  department: document.querySelector("#department"),
  topic: document.querySelector("#topic"),
  attendees: document.querySelector("#attendees"),
  capacityHelp: document.querySelector("#capacity-help"),
  facilitator: document.querySelector("#facilitator"),
  notes: document.querySelector("#notes"),
  availability: document.querySelector("#availability-message"),
  saveButton: document.querySelector("#save-reservation"),
  cancelEdit: document.querySelector("#cancel-edit"),
  weekLabel: document.querySelector("#week-label"),
  weekBoard: document.querySelector("#week-board"),
  monthLabel: document.querySelector("#month-label"),
  monthCalendar: document.querySelector("#month-calendar"),
  monthTotalReservations: document.querySelector("#month-total-reservations"),
  monthTotalAttendees: document.querySelector("#month-total-attendees"),
  monthUsedRooms: document.querySelector("#month-used-rooms"),
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
  emailPreview: document.querySelector("#email-preview"),
  emailName: document.querySelector("#email-name"),
  emailRoomText: document.querySelector("#email-room-text"),
  emailFloorNumber: document.querySelector("#email-floor-number"),
  emailTableTitle: document.querySelector("#email-table-title"),
  emailTableDate: document.querySelector("#email-table-date"),
  emailTableResponsible: document.querySelector("#email-table-responsible"),
  emailTableDepartment: document.querySelector("#email-table-department"),
  emailTableTopic: document.querySelector("#email-table-topic"),
  emailTableAttendees: document.querySelector("#email-table-attendees"),
  emailTableSchedule: document.querySelector("#email-table-schedule"),
  emailTableHours: document.querySelector("#email-table-hours"),
  emailTableRequester: document.querySelector("#email-table-requester"),
  openEmail: document.querySelector("#open-email"),
  toast: document.querySelector("#toast"),
};

initialize();

async function initialize() {
  setDefaultFormValues();
  bindEvents();
  populateRoomSelect(elements.calendarRoom, "");
  renderAll();
  if (usesSharedStorage()) {
    await synchronizeWithServer({ migrateLocal: true, silent: true });
    window.setInterval(() => synchronizeWithServer({ silent: true }), SYNC_INTERVAL_MS);
  }
}

function bindEvents() {
  elements.tabs.forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.tab));
  });

  document.querySelector("#calendar-new").addEventListener("click", startNewReservation);
  document.querySelector("#month-new").addEventListener("click", startNewReservation);
  document.querySelector("#history-new").addEventListener("click", startNewReservation);
  document.querySelector("#previous-week").addEventListener("click", () => changeWeek(-7));
  document.querySelector("#next-week").addEventListener("click", () => changeWeek(7));
  document.querySelector("#today-week").addEventListener("click", () => {
    state.weekStart = getStartOfWeek(new Date());
    renderCalendar();
  });
  document.querySelector("#previous-month").addEventListener("click", () => changeMonth(-1));
  document.querySelector("#next-month").addEventListener("click", () => changeMonth(1));
  document.querySelector("#current-month").addEventListener("click", () => {
    const today = new Date();
    state.monthDate = new Date(today.getFullYear(), today.getMonth(), 1, 12);
    renderMonthlyCalendar();
  });

  elements.floor.addEventListener("change", () => {
    populateRoomSelect(elements.room, elements.floor.value, true);
    updateRoomDetails();
    updateAvailability();
  });
  elements.date.addEventListener("change", () => {
    updateEndDateLimits();
    updateAvailability();
  });
  elements.endDate.addEventListener("change", updateAvailability);
  elements.room.addEventListener("change", () => {
    updateRoomDetails();
    updateAvailability();
  });
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
  elements.openEmail.addEventListener("click", openFormattedEmail);
  window.addEventListener("storage", synchronizeStoredReservations);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) synchronizeWithServer({ silent: true });
  });
}

function loadReservations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrateStoredReservation).filter(isValidStoredReservation);
  } catch (error) {
    console.warn("No se pudo cargar el historial de reservas.", error);
    return [];
  }
}

function migrateStoredReservation(item) {
  if (!item || typeof item !== "object") return item;
  const room = LEGACY_ROOM_NAMES[item.room] || item.room;
  return { ...item, room, appVersion: APP_VERSION };
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

function saveReservations(reservations = state.reservations) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
    return true;
  } catch (error) {
    console.error("No se pudieron guardar las reservas.", error);
    showToast("No se pudo guardar el cambio. Revisa el almacenamiento del navegador.");
    return false;
  }
}

function usesSharedStorage() {
  return window.location.protocol === "https:" && !window.location.hostname.endsWith("github.io");
}

async function requestSharedReservations(method = "GET", body) {
  const response = await fetch(API_ENDPOINT, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la operación compartida.");
  return payload.reservations.map(migrateStoredReservation).filter(isValidStoredReservation);
}

async function synchronizeWithServer({ migrateLocal = false, silent = false } = {}) {
  if (!usesSharedStorage() || state.syncInProgress) return false;
  state.syncInProgress = true;
  try {
    if (migrateLocal && !localStorage.getItem(SHARED_MIGRATION_KEY) && state.reservations.length) {
      await requestSharedReservations("PUT", { reservations: state.reservations });
      localStorage.setItem(SHARED_MIGRATION_KEY, "done");
    }
    const reservations = await requestSharedReservations();
    state.reservations = reservations;
    saveReservations(reservations);
    if (state.activeEmailId && !reservations.some((item) => item.id === state.activeEmailId)) hideEmailPanel();
    renderAll();
    return true;
  } catch (error) {
    console.error("No se pudieron sincronizar las reservas compartidas.", error);
    if (!silent) showToast(error.message);
    return false;
  } finally {
    state.syncInProgress = false;
  }
}

async function saveSharedReservations(reservations) {
  try {
    const updatedReservations = await requestSharedReservations("POST", { reservations });
    state.reservations = updatedReservations;
    saveReservations(updatedReservations);
    return true;
  } catch (error) {
    console.error("No se pudieron guardar las reservas compartidas.", error);
    showToast(error.message);
    return false;
  }
}

async function deleteSharedReservation(id) {
  try {
    const reservations = await requestSharedReservations("DELETE", { id });
    state.reservations = reservations;
    saveReservations(reservations);
    return true;
  } catch (error) {
    console.error("No se pudo eliminar la reserva compartida.", error);
    showToast(error.message);
    return false;
  }
}

function synchronizeStoredReservations(event) {
  if (event.key !== STORAGE_KEY) return;
  state.reservations = loadReservations();
  if (state.activeEmailId && !state.reservations.some((item) => item.id === state.activeEmailId)) {
    hideEmailPanel();
  }
  renderAll();
  showToast("Reservas actualizadas desde otra pestaña.");
}

function showView(name) {
  elements.tabs.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === name));
  elements.views.forEach((view) => view.classList.toggle("is-active", view.id === `${name}-view`));
  if (name === "calendar") renderCalendar();
  if (name === "month") renderMonthlyCalendar();
  if (name === "history") renderHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startNewReservation() {
  resetForm();
  showView("form");
  requestAnimationFrame(() => elements.date.focus());
}

function setDefaultFormValues() {
  const today = formatDateKey(new Date());
  elements.date.value = today;
  elements.endDate.value = today;
  elements.endDate.disabled = false;
  updateEndDateLimits();
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
  elements.endDate.disabled = false;
  elements.room.disabled = true;
  elements.room.innerHTML = '<option value="">Selecciona primero el piso</option>';
  elements.roomDetails.textContent = "";
  elements.capacityHelp.textContent = "Selecciona un aula para consultar su aforo.";
  elements.attendees.removeAttribute("max");
  clearFieldErrors();
  elements.availability.textContent = "";
  elements.availability.className = "availability-message";
  setDefaultFormValues();
}

function updateEndDateLimits() {
  if (!elements.date.value) {
    elements.endDate.min = "";
    elements.endDate.max = "";
    return;
  }
  const maximumDate = formatDateKey(addDays(parseLocalDate(elements.date.value), MAX_RESERVATION_DAYS - 1));
  elements.endDate.min = elements.date.value;
  elements.endDate.max = maximumDate;
  if (
    !elements.endDate.value ||
    elements.endDate.value < elements.date.value ||
    elements.endDate.value > maximumDate
  ) {
    elements.endDate.value = elements.date.value;
  }
}

function populateRoomSelect(select, floor, placeholderForForm = false) {
  const currentValue = select.value;
  const rooms = floor ? ROOM_CATALOG[floor] || [] : Object.values(ROOM_CATALOG).flat();
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
    option.value = room.name;
    option.textContent = `${room.name} — ${room.type}`;
    select.append(option);
  });
  select.disabled = placeholderForForm && !floor;
  if (rooms.some((room) => room.name === currentValue)) select.value = currentValue;
}

function getRoomDetails(floor, roomName) {
  return (ROOM_CATALOG[floor] || []).find((room) => room.name === roomName) || null;
}

function updateRoomDetails() {
  const room = getRoomDetails(elements.floor.value, elements.room.value);
  if (!room) {
    elements.roomDetails.textContent = "";
    elements.capacityHelp.textContent = "Selecciona un aula para consultar su aforo.";
    elements.attendees.removeAttribute("max");
    return;
  }
  elements.roomDetails.textContent = `${room.type}. Aforo máximo: ${room.capacity} personas.`;
  elements.capacityHelp.textContent = `Máximo permitido para ${room.name}: ${room.capacity} personas.`;
  elements.attendees.max = String(room.capacity);
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
    endDate: elements.endDate.value,
    room: elements.room.value,
    startTime: elements.startTime.value,
    endTime: elements.endTime.value,
  };
  elements.availability.className = "availability-message";
  const reservationDates = getReservationDateKeys(data.date, data.endDate);
  if (!reservationDates.length || !data.room || calculateHours(data.startTime, data.endTime) === null) {
    elements.availability.textContent = "";
    return;
  }
  const conflict = reservationDates
    .map((date) => ({ date, reservation: findConflict({ ...data, date }) }))
    .find(({ reservation }) => reservation);
  if (conflict) {
    elements.availability.textContent = `Horario ocupado el ${formatCompactDate(conflict.date)} por ${conflict.reservation.responsible}: ${conflict.reservation.startTime} a ${conflict.reservation.endTime}.`;
    elements.availability.classList.add("is-conflict");
  } else {
    elements.availability.textContent =
      reservationDates.length === 1
        ? "Aula disponible en este horario."
        : `Aula disponible durante los ${reservationDates.length} días seleccionados.`;
    elements.availability.classList.add("is-available");
  }
}

function getReservationDateKeys(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (end < start) return [];
  const dates = [];
  for (let offset = 0; offset < MAX_RESERVATION_DAYS; offset += 1) {
    const current = addDays(start, offset);
    if (current > end) break;
    dates.push(formatDateKey(current));
  }
  return dates.at(-1) === endDate ? dates : [];
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

async function handleSubmit(event) {
  event.preventDefault();
  clearFieldErrors();
  const data = collectFormData();
  if (!validateReservation(data)) return;

  const now = new Date().toISOString();
  const existingIndex = state.reservations.findIndex((item) => item.id === data.id);
  const { endDate, ...reservationData } = data;
  let reservationsToSave;
  let nextReservations;
  if (existingIndex >= 0) {
    const updatedReservation = {
      ...reservationData,
      createdAt: state.reservations[existingIndex].createdAt,
      updatedAt: now,
    };
    reservationsToSave = [updatedReservation];
    nextReservations = [...state.reservations];
    nextReservations[existingIndex] = updatedReservation;
  } else {
    const reservationDates = getReservationDateKeys(data.date, endDate);
    const seriesId = reservationDates.length > 1 ? createId() : "";
    reservationsToSave = reservationDates.map((date) => ({
      ...reservationData,
      id: createId(),
      date,
      seriesId,
      seriesStart: data.date,
      seriesEnd: endDate,
      createdAt: now,
      updatedAt: now,
    }));
    nextReservations = [...state.reservations, ...reservationsToSave];
  }

  elements.saveButton.disabled = true;
  if (usesSharedStorage()) {
    if (!(await saveSharedReservations(reservationsToSave))) {
      elements.saveButton.disabled = false;
      return;
    }
  } else {
    if (!saveReservations(nextReservations)) {
      elements.saveButton.disabled = false;
      return;
    }
    state.reservations = nextReservations;
  }
  elements.saveButton.disabled = false;
  const activeReservation = reservationsToSave[0];
  state.activeEmailId = activeReservation.id;
  renderAll();
  showEmailPanel(activeReservation.id);
  resetForm();
  showToast(
    existingIndex >= 0
      ? "Reserva actualizada correctamente."
      : reservationsToSave.length === 1
        ? "Reserva guardada correctamente."
        : `${reservationsToSave.length} reservas guardadas, una por cada día seleccionado.`,
  );
}

function collectFormData() {
  return {
    id: elements.id.value,
    date: elements.date.value,
    endDate: elements.endDate.value,
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
    [elements.date, data.date, "Selecciona la fecha inicial."],
    [elements.endDate, data.endDate, "Selecciona la fecha final."],
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

  const selectedRoom = getRoomDetails(data.floor, data.room);
  if (selectedRoom && data.attendees > selectedRoom.capacity) {
    setFieldError(
      elements.attendees,
      `${selectedRoom.name} admite un máximo de ${selectedRoom.capacity} personas.`,
    );
    valid = false;
  }

  if (data.startTime && data.endTime && calculateHours(data.startTime, data.endTime) === null) {
    setFieldError(elements.endTime, "La hora de fin debe ser posterior a la hora de inicio.");
    valid = false;
  }

  const reservationDates = getReservationDateKeys(data.date, data.endDate);
  if (data.date && data.endDate && !reservationDates.length) {
    setFieldError(elements.endDate, `La fecha final debe estar entre la fecha inicial y un máximo de ${MAX_RESERVATION_DAYS} días.`);
    valid = false;
  }

  const conflict = valid
    ? reservationDates
        .map((date) => ({ date, reservation: findConflict({ ...data, date }) }))
        .find(({ reservation }) => reservation)
    : null;
  if (conflict) {
    setFieldError(elements.startTime, "Este horario se cruza con otra reserva.");
    setFieldError(elements.endTime, `${formatCompactDate(conflict.date)} · ${conflict.reservation.responsible}: ${conflict.reservation.startTime} a ${conflict.reservation.endTime}.`);
    elements.availability.textContent = `No se puede guardar: ${data.room} ya está reservada el ${formatCompactDate(conflict.date)} de ${conflict.reservation.startTime} a ${conflict.reservation.endTime}.`;
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
  elements.endDate.value = item.date;
  updateEndDateLimits();
  elements.endDate.disabled = true;
  elements.floor.value = item.floor;
  populateRoomSelect(elements.room, item.floor, true);
  elements.room.value = item.room;
  updateRoomDetails();
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

async function deleteReservation(id) {
  const item = state.reservations.find((reservation) => reservation.id === id);
  if (!item) return;
  const confirmed = window.confirm(`¿Eliminar la reserva de ${item.room} del ${formatLongDate(item.date)}?`);
  if (!confirmed) return;
  const nextReservations = state.reservations.filter((reservation) => reservation.id !== id);
  if (usesSharedStorage()) {
    if (!(await deleteSharedReservation(id))) return;
  } else {
    if (!saveReservations(nextReservations)) return;
    state.reservations = nextReservations;
  }
  if (state.activeEmailId === id) hideEmailPanel();
  renderAll();
  showToast("Reserva eliminada.");
}

function renderAll() {
  state.reservations.sort(compareReservations);
  renderCalendar();
  renderMonthlyCalendar();
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
          <small><b>Marca:</b> ${escapeHtml(item.department)}</small>
          <small>${escapeHtml(item.floor)} · ${Number(item.attendees)} ${Number(item.attendees) === 1 ? "persona" : "personas"}</small>
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

function changeMonth(months) {
  state.monthDate = new Date(
    state.monthDate.getFullYear(),
    state.monthDate.getMonth() + months,
    1,
    12,
  );
  renderMonthlyCalendar();
}

function renderMonthlyCalendar() {
  const year = state.monthDate.getFullYear();
  const month = state.monthDate.getMonth();
  const monthStart = new Date(year, month, 1, 12);
  const gridStart = getStartOfWeek(monthStart);
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthReservations = state.reservations.filter((item) => item.date.startsWith(monthKey));

  elements.monthLabel.textContent = new Intl.DateTimeFormat("es-EC", {
    month: "long",
    year: "numeric",
  }).format(monthStart);
  elements.monthTotalReservations.textContent = String(monthReservations.length);
  elements.monthTotalAttendees.textContent = String(
    monthReservations.reduce((total, item) => total + Number(item.attendees || 0), 0),
  );
  elements.monthUsedRooms.textContent = String(new Set(monthReservations.map((item) => item.room)).size);
  elements.monthCalendar.innerHTML = "";

  const todayKey = formatDateKey(new Date());
  Array.from({ length: 42 }, (_, index) => addDays(gridStart, index)).forEach((date) => {
    const dateKey = formatDateKey(date);
    const items = state.reservations.filter((item) => item.date === dateKey);
    const cell = document.createElement("article");
    cell.className = [
      "month-day",
      date.getMonth() !== month ? "is-outside" : "",
      dateKey === todayKey ? "is-today" : "",
    ]
      .filter(Boolean)
      .join(" ");
    cell.innerHTML = `
      <header class="month-day-header">
        <span class="month-day-number">${date.getDate()}</span>
        ${items.length ? `<span class="month-day-count">${items.length} ${items.length === 1 ? "reserva" : "reservas"}</span>` : ""}
      </header>
      <div class="month-reservations"></div>
    `;
    const list = cell.querySelector(".month-reservations");
    items.slice(0, 3).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "month-reservation";
      button.innerHTML = `
        <strong>${escapeHtml(item.startTime)} · ${escapeHtml(item.room)}</strong>
        <span><b>Marca:</b> ${escapeHtml(item.department)}</span>
        <span>${Number(item.attendees)} ${Number(item.attendees) === 1 ? "persona" : "personas"}</span>
      `;
      button.addEventListener("click", () => editReservation(item.id));
      list.append(button);
    });
    if (items.length > 3) {
      const more = document.createElement("span");
      more.className = "month-more";
      more.textContent = `+ ${items.length - 3} más`;
      list.append(more);
    }
    elements.monthCalendar.append(cell);
  });
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
    const roomDetails = getRoomDetails(item.floor, item.room);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(formatCompactDate(item.date))}</strong></td>
      <td>${escapeHtml(item.startTime)} – ${escapeHtml(item.endTime)}<small>${escapeHtml(formatHours(calculateHours(item.startTime, item.endTime)))}</small></td>
      <td><strong>${escapeHtml(item.room)}</strong><small>${escapeHtml(item.floor)}${roomDetails ? ` · ${escapeHtml(roomDetails.type)}` : ""}</small></td>
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
  const subject = `Reserva de aula | ${item.room} | ${formatReservationPeriod(item, formatCompactDate)}`;
  const body = buildEmailBody(item);
  const floorNumber = item.floor.replace(/[^0-9]/g, "");
  elements.emailSubject.value = subject;
  elements.emailBody.value = body;
  elements.emailName.textContent = item.responsible;
  elements.emailRoomText.textContent = item.room;
  elements.emailFloorNumber.textContent = floorNumber;
  elements.emailTableTitle.textContent = `RESERVA DE AULA - ${item.floor.toUpperCase()} / ${item.room.toUpperCase()}`;
  elements.emailTableDate.textContent = formatReservationPeriod(item, formatEmailDate);
  elements.emailTableResponsible.textContent = item.responsible.toUpperCase();
  elements.emailTableDepartment.textContent = item.department.toUpperCase();
  elements.emailTableTopic.textContent = item.topic.toUpperCase();
  elements.emailTableAttendees.textContent = String(item.attendees);
  elements.emailTableSchedule.textContent = `${item.startTime} - ${item.endTime}`;
  elements.emailTableHours.textContent = formatHours(calculateHours(item.startTime, item.endTime));
  elements.emailTableRequester.textContent = item.responsible.toUpperCase();
  elements.emailEmpty.classList.add("is-hidden");
  elements.emailContent.classList.remove("is-hidden");
}

function hideEmailPanel() {
  state.activeEmailId = null;
  elements.emailContent.classList.add("is-hidden");
  elements.emailEmpty.classList.remove("is-hidden");
}

function buildEmailBody(item) {
  const floorNumber = item.floor.replace(/[^0-9]/g, "");
  const lines = [
    `Buenos días, ${item.responsible}:`,
    "",
    `Según lo conversado, te confirmo la reserva del aula ${item.room}, ubicada en el piso ${floorNumber}, para el período y el horario indicados.`,
    "",
    `RESERVA DE AULA - ${item.floor.toUpperCase()} / ${item.room.toUpperCase()}`,
    "DATOS | QUITO",
    `PERÍODO | ${formatReservationPeriod(item, formatEmailDate)}`,
    `RESPONSABLE DE LA RESERVA | ${item.responsible.toUpperCase()}`,
    `DEPARTAMENTO / MARCA | ${item.department.toUpperCase()}`,
    `TEMA O MÓDULO | ${item.topic.toUpperCase()}`,
    `N.º DE ASISTENTES | ${item.attendees}`,
    `HORARIO | ${item.startTime} - ${item.endTime}`,
    `TOTAL DE HORAS | ${formatHours(calculateHours(item.startTime, item.endTime))}`,
    `SOLICITANTE | ${item.responsible.toUpperCase()}`,
    "",
    "Por favor, si existiera una cancelación, deberás realizarla con al menos 24 horas de anticipación.",
    "",
    "Adjunto te comparto las políticas de uso de las aulas y equipos del CFC.",
    "",
    "Te invitamos a ayudarnos a cuidar estos espacios, que son para el uso de todos.",
    "",
    "Desde el Departamento de Capacitación, siempre será un gusto servirte.",
    "",
    "Saludos,",
  ];
  return lines.join("\n");
}

function buildEmailHtml(item) {
  const floorNumber = item.floor.replace(/[^0-9]/g, "");
  const hours = formatHours(calculateHours(item.startTime, item.endTime));
  const row = (label, value, highlighted = false) => `
    <tr>
      <th style="width:44%;padding:7px 8px;color:#fff;background:#8f1537;border:2px solid #111;text-align:left;font-family:Arial,sans-serif;font-size:12px;">${label}</th>
      <td style="padding:7px 8px;color:${highlighted ? "#fff" : "#111"};background:${highlighted ? "#a90d27" : "#fff"};border:2px solid #111;text-align:center;font-family:Arial,sans-serif;font-size:12px;font-weight:700;">${escapeHtml(value)}</td>
    </tr>`;
  return `
    <div style="color:#231f20;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;">
      <p>Buenos días, <strong>${escapeHtml(item.responsible)}</strong>:</p>
      <p>Según lo conversado, te confirmo la reserva del aula <strong>${escapeHtml(item.room)}</strong>, ubicada en el piso <strong>${escapeHtml(floorNumber)}</strong>, para el período y el horario indicados.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;margin:20px 0;border:3px solid #111;border-collapse:collapse;table-layout:fixed;">
        <tr><th colspan="2" style="padding:8px;color:#fff;background:#8f1537;border:2px solid #111;text-align:center;font-family:Arial,sans-serif;font-size:14px;">RESERVA DE AULA - ${escapeHtml(item.floor.toUpperCase())} / ${escapeHtml(item.room.toUpperCase())}</th></tr>
        <tr><th style="width:44%;padding:7px 8px;color:#fff;background:#8f1537;border:2px solid #111;text-align:center;font-family:Arial,sans-serif;font-size:12px;">DATOS</th><th style="padding:7px 8px;color:#fff;background:#681126;border:2px solid #111;text-align:center;font-family:Arial,sans-serif;font-size:12px;">QUITO</th></tr>
        <tr><th style="padding:7px 8px;color:#fff;background:#8f1537;border:2px solid #111;text-align:left;font-family:Arial,sans-serif;font-size:12px;">PERÍODO</th><td style="padding:7px 8px;color:#231f20;background:#d9dde1;border:2px solid #111;text-align:center;font-family:Arial,sans-serif;font-size:12px;font-weight:700;">${escapeHtml(formatReservationPeriod(item, formatEmailDate))}</td></tr>
        ${row("RESPONSABLE DE LA RESERVA", item.responsible.toUpperCase(), true)}
        ${row("DEPARTAMENTO / MARCA", item.department.toUpperCase())}
        ${row("TEMA O MÓDULO", item.topic.toUpperCase())}
        ${row("N.º DE ASISTENTES", String(item.attendees))}
        ${row("HORARIO", `${item.startTime} - ${item.endTime}`)}
        ${row("TOTAL DE HORAS", hours)}
        ${row("SOLICITANTE", item.responsible.toUpperCase())}
      </table>
      <p>Por favor, si existiera una cancelación, deberás realizarla con al menos 24 horas de anticipación.</p>
      <p><strong>Adjunto te comparto las políticas de uso de las aulas y equipos del CFC.</strong></p>
      <p>Te invitamos a ayudarnos a cuidar estos espacios, que son para el uso de todos.</p>
      <p>Desde el Departamento de Capacitación, <strong>siempre será un gusto servirte</strong>.</p>
      <p>Saludos,</p>
    </div>`;
}

async function copyEmailMessage() {
  const item = state.reservations.find((reservation) => reservation.id === state.activeEmailId);
  if (!item) return;
  const copied = await copyFormattedEmailToClipboard(item);
  showToast(copied ? "Correo con formato copiado. Pégalo en Outlook o Gmail." : "Se copió la versión en texto del correo.");
}

async function copyFormattedEmailToClipboard(item) {
  const text = elements.emailBody.value;
  const html = buildEmailHtml(item);
  try {
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    return true;
  } catch {
    elements.emailBody.select();
    document.execCommand("copy");
    return false;
  }
}

async function openFormattedEmail() {
  const item = state.reservations.find((reservation) => reservation.id === state.activeEmailId);
  if (!item) return;
  const copied = await copyFormattedEmailToClipboard(item);
  const subject = encodeURIComponent(elements.emailSubject.value);
  showToast(copied ? "Formato copiado. Pégalo con Ctrl + V en el correo." : "Texto copiado. Pégalo con Ctrl + V en el correo.");
  window.location.href = `mailto:?subject=${subject}`;
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

function formatEmailDate(dateKey) {
  const date = parseLocalDate(dateKey);
  const weekday = new Intl.DateTimeFormat("es-EC", { weekday: "long" }).format(date).toUpperCase();
  const numericDate = new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  return `${weekday}: ${numericDate}`;
}

function formatReservationPeriod(item, formatter) {
  const startDate = item.seriesStart || item.date;
  const endDate = item.seriesEnd || item.date;
  return startDate === endDate ? formatter(startDate) : `${formatter(startDate)} AL ${formatter(endDate)}`;
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
