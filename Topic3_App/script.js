const form = document.getElementById("dataForm");
const tableBody = document.getElementById("dataTableBody");
const message = document.getElementById("message");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const formMode = document.getElementById("formMode");
const clearDataBtn = document.getElementById("clearDataBtn");
const undoDeleteBtn = document.getElementById("undoDeleteBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const importCsvBtn = document.getElementById("importCsvBtn");
const csvFileInput = document.getElementById("csvFileInput");
const searchFilter = document.getElementById("searchFilter");
const shiftFilter = document.getElementById("shiftFilter");
const statusFilter = document.getElementById("statusFilter");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const emptyState = document.getElementById("emptyState");
const summaryTotal = document.getElementById("summaryTotal");
const summaryOk = document.getElementById("summaryOk");
const summaryWarning = document.getElementById("summaryWarning");
const summaryCritical = document.getElementById("summaryCritical");
const trendMeta = document.getElementById("trendMeta");
const trendList = document.getElementById("trendList");
const sortButtons = document.querySelectorAll(".sort-btn");
const machineIdInput = document.getElementById("machineId");
const operatorIdInput = document.getElementById("operatorId");
const shiftInput = document.getElementById("shift");
const tempInput = document.getElementById("temp");
const pressureInput = document.getElementById("pressure");
const statusInput = document.getElementById("status");
const machineIdError = document.getElementById("machineIdError");
const operatorIdError = document.getElementById("operatorIdError");
const shiftError = document.getElementById("shiftError");
const tempError = document.getElementById("tempError");
const pressureError = document.getElementById("pressureError");
const statusError = document.getElementById("statusError");

const fieldInputs = {
  machine: machineIdInput,
  operator: operatorIdInput,
  shift: shiftInput,
  temp: tempInput,
  pressure: pressureInput,
  status: statusInput,
};

const fieldErrorElements = {
  machine: machineIdError,
  operator: operatorIdError,
  shift: shiftError,
  temp: tempError,
  pressure: pressureError,
  status: statusError,
};

const STORAGE_KEY = "shopfloorRecords";
const FILTER_ALL = "All";
const SORT_ASC = "asc";
const SORT_DESC = "desc";
const LIMITS = {
  temperature: { min: 0, max: 120 },
  pressure: { min: 1, max: 20 },
};

const VALID_SHIFTS = ["A", "B", "C"];
const VALID_STATUSES = ["OK", "Warning", "Critical"];
const VALIDATION_ORDER = ["machine", "operator", "shift", "temp", "pressure", "status"];

const STATUS_CLASS_MAP = {
  OK: "status-ok",
  Warning: "status-warning",
  Critical: "status-critical",
};

const STATUS_SORT_ORDER = {
  OK: 1,
  Warning: 2,
  Critical: 3,
};

const CSV_EXPORT_COLUMNS = [
  "timestampIso",
  "timestampDisplay",
  "updatedAtIso",
  "machine",
  "operator",
  "shift",
  "temp",
  "pressure",
  "status",
];

const REQUIRED_IMPORT_COLUMNS = ["machine", "operator", "shift", "temp", "pressure", "status"];

const CSV_COLUMN_ALIASES = {
  timestampiso: "timestampIso",
  timestamp: "timestampIso",
  timestampdisplay: "timestampDisplay",
  updatedatiso: "updatedAtIso",
  updatedat: "updatedAtIso",
  machine: "machine",
  machineid: "machine",
  operator: "operator",
  operatorid: "operator",
  shift: "shift",
  shiftcode: "shift",
  temp: "temp",
  temperature: "temp",
  temperaturec: "temp",
  pressure: "pressure",
  pressurebar: "pressure",
  status: "status",
};

let editRecordId = "";
let lastDeletedRecordState = null;
let useInMemoryStorage = false;
let inMemoryRecords = [];
let storageFallbackNotified = false;

const sortState = {
  key: "timestamp",
  direction: SORT_DESC,
};

function deriveStatus(temp, pressure) {
  if (temp >= 100 || pressure >= 18) return "Critical";
  if (temp >= 80 || pressure >= 15) return "Warning";
  return "OK";
}

function updateStatusPreview() {
  const preview = document.getElementById("statusPreview");
  const temp = Number(tempInput.value);
  const pressure = Number(pressureInput.value);

  if (Number.isNaN(temp) || Number.isNaN(pressure)) {
    statusInput.value = "OK";
    preview.innerText = "OK";
    preview.className = getStatusClass("OK");
    return;
  }

  const status = deriveStatus(temp, pressure);
  statusInput.value = status;
  preview.innerText = status;
  preview.className = getStatusClass(status);
}

function createRecordId() {
  return "rec-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function normalizeShift(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeStatus(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "ok") return "OK";
  if (normalized === "warning") return "Warning";
  if (normalized === "critical") return "Critical";
  return String(value ?? "").trim();
}

function getStatusClass(status) {
  return STATUS_CLASS_MAP[status] || "status-critical";
}

function setEditMode(isEditMode) {
  submitBtn.innerText = isEditMode ? "Update Record" : "Submit";
  cancelEditBtn.hidden = !isEditMode;
  formMode.hidden = !isEditMode;
}

function clearFieldError(fieldKey) {
  const input = fieldInputs[fieldKey];
  const errorElement = fieldErrorElements[fieldKey];

  if (input) {
    input.classList.remove("field-invalid");
    input.setAttribute("aria-invalid", "false");
  }

  if (errorElement) {
    errorElement.innerText = "";
  }
}

function setFieldError(fieldKey, errorText) {
  const input = fieldInputs[fieldKey];
  const errorElement = fieldErrorElements[fieldKey];

  if (input) {
    input.classList.add("field-invalid");
    input.setAttribute("aria-invalid", "true");
  }

  if (errorElement) {
    errorElement.innerText = errorText;
  }
}

function clearFieldErrors() {
  VALIDATION_ORDER.forEach(function(fieldKey) {
    clearFieldError(fieldKey);
  });
}

function applyFieldErrors(fieldErrors) {
  clearFieldErrors();

  Object.keys(fieldErrors).forEach(function(fieldKey) {
    setFieldError(fieldKey, fieldErrors[fieldKey]);
  });
}

function getFirstFieldKey(fieldErrors) {
  for (let index = 0; index < VALIDATION_ORDER.length; index += 1) {
    const fieldKey = VALIDATION_ORDER[index];
    if (fieldErrors[fieldKey]) {
      return fieldKey;
    }
  }

  return "";
}

function focusFirstInvalidField(fieldErrors) {
  const firstFieldKey = getFirstFieldKey(fieldErrors);
  const firstInput = fieldInputs[firstFieldKey];
  if (firstInput) {
    firstInput.focus();
  }
}

function exitEditMode() {
  editRecordId = "";
  setEditMode(false);
}

function updateUndoButtonState() {
  undoDeleteBtn.disabled = !lastDeletedRecordState;
}

function clearUndoState() {
  lastDeletedRecordState = null;
  updateUndoButtonState();
}

function setUndoState(record, index) {
  lastDeletedRecordState = {
    record: { ...record },
    index,
  };
  updateUndoButtonState();
}

function notifyStorageFallback() {
  if (storageFallbackNotified) {
    return;
  }

  storageFallbackNotified = true;
  showMessage("Browser storage unavailable. Data is saved in memory for this tab.", true);
}

function getDisplayTimestamp(record) {
  if (record.timestampDisplay) return record.timestampDisplay;

  if (record.timestampIso) {
    const parsedDate = new Date(record.timestampIso);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleString();
    }
  }

  if (record.timestamp) return record.timestamp;

  return "-";
}

function getDisplayUpdatedTimestamp(record) {
  if (record.updatedAtIso) {
    const parsedUpdatedDate = new Date(record.updatedAtIso);
    if (!Number.isNaN(parsedUpdatedDate.getTime())) {
      return parsedUpdatedDate.toLocaleString();
    }
  }

  if (record.updatedAt) {
    const parsedLegacyUpdated = new Date(record.updatedAt);
    if (!Number.isNaN(parsedLegacyUpdated.getTime())) {
      return parsedLegacyUpdated.toLocaleString();
    }

    return String(record.updatedAt);
  }

  return "-";
}

function getRecordDate(record) {
  const sourceTimestamp = record.timestampIso || record.timestamp;
  if (!sourceTimestamp) {
    return null;
  }

  const parsedDate = new Date(sourceTimestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function createRow(record) {
  const row = document.createElement("tr");
  const values = [
    getDisplayTimestamp(record),
    record.machine,
    record.operator,
    record.shift,
    record.temp,
    record.pressure,
  ];

  values.forEach(function(value) {
    const cell = document.createElement("td");
    cell.innerText = String(value ?? "");
    row.appendChild(cell);
  });

  const statusCell = document.createElement("td");
  statusCell.innerText = record.status;
  statusCell.className = getStatusClass(record.status);
  row.appendChild(statusCell);

  const auditCell = document.createElement("td");
  auditCell.className = "audit-cell";

  const createdLine = document.createElement("p");
  createdLine.className = "audit-line";
  createdLine.innerText = "C: " + getDisplayTimestamp(record);

  const updatedLine = document.createElement("p");
  updatedLine.className = "audit-line";
  updatedLine.innerText = "U: " + getDisplayUpdatedTimestamp(record);

  auditCell.appendChild(createdLine);
  auditCell.appendChild(updatedLine);
  row.appendChild(auditCell);

  const actionCell = document.createElement("td");
  const actionWrapper = document.createElement("div");
  actionWrapper.className = "row-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "action-btn edit";
  editButton.innerText = "Edit";
  editButton.setAttribute("data-action", "edit");
  editButton.setAttribute("data-record-id", record.recordId);
  editButton.setAttribute("aria-label", "Edit record for machine " + String(record.machine ?? ""));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "action-btn delete";
  deleteButton.innerText = "Delete";
  deleteButton.setAttribute("data-action", "delete");
  deleteButton.setAttribute("data-record-id", record.recordId);
  deleteButton.setAttribute("aria-label", "Delete record for machine " + String(record.machine ?? ""));

  actionWrapper.appendChild(editButton);
  actionWrapper.appendChild(deleteButton);
  actionCell.appendChild(actionWrapper);
  row.appendChild(actionCell);

  return row;
}

function showMessage(text, isError) {
  message.innerText = text;
  message.style.color = isError ? "#991b1b" : "#166534";
  message.setAttribute("role", isError ? "alert" : "status");
  message.setAttribute("aria-live", isError ? "assertive" : "polite");
}

function getSavedRecords() {
  if (useInMemoryStorage) {
    return inMemoryRecords.slice();
  }

  let rawData = "";
  try {
    rawData = localStorage.getItem(STORAGE_KEY);
  } catch {
    useInMemoryStorage = true;
    notifyStorageFallback();
    return inMemoryRecords.slice();
  }

  if (!rawData) return [];

  try {
    const parsedData = JSON.parse(rawData);
    if (!Array.isArray(parsedData)) {
      localStorage.removeItem(STORAGE_KEY);
      showMessage("Saved data had an invalid format and was reset.", true);
      return [];
    }

    const normalizedRecords = [];
    let didNormalize = false;

    parsedData.forEach(function(record) {
      if (!record || typeof record !== "object") {
        didNormalize = true;
        return;
      }

      const normalizedRecord = { ...record };
      if (!normalizedRecord.recordId) {
        normalizedRecord.recordId = createRecordId();
        didNormalize = true;
      }

      normalizedRecords.push(normalizedRecord);
    });

    if (didNormalize) {
      saveRecords(normalizedRecords);
    }

    return normalizedRecords;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      useInMemoryStorage = true;
      notifyStorageFallback();
      return inMemoryRecords.slice();
    }
    showMessage("Saved data could not be read and was reset.", true);
    return [];
  }
}

function saveRecords(records) {
  if (useInMemoryStorage) {
    inMemoryRecords = records.slice();
    return true;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    useInMemoryStorage = true;
    inMemoryRecords = records.slice();
    notifyStorageFallback();
    return true;
  }
}

function getFormData() {
  const temp = Number(tempInput.value);
  const pressure = Number(pressureInput.value);

  return {
    machine: machineIdInput.value.trim(),
    operator: operatorIdInput.value.trim(),
    shift: normalizeShift(shiftInput.value),
    temp,
    pressure,
    status: deriveStatus(temp, pressure)
  };
}

function validateFormData(data) {
  const fieldErrors = {};

  if (!data.machine) {
    fieldErrors.machine = "Machine ID is required.";
  }

  if (!data.operator) {
    fieldErrors.operator = "Operator ID is required.";
  }

  if (!VALID_SHIFTS.includes(data.shift)) {
    fieldErrors.shift = "Shift must be A, B, or C.";
  }

  if (!VALID_STATUSES.includes(data.status)) {
    fieldErrors.status = "Status must be OK, Warning, or Critical.";
  }

  if (
    Number.isNaN(data.temp) ||
    data.temp < LIMITS.temperature.min ||
    data.temp > LIMITS.temperature.max
  ) {
    fieldErrors.temp = "Temperature must be between 0 and 120 C.";
  }

  if (
    Number.isNaN(data.pressure) ||
    data.pressure < LIMITS.pressure.min ||
    data.pressure > LIMITS.pressure.max
  ) {
    fieldErrors.pressure = "Pressure must be between 1 and 20 bar.";
  }

  const firstFieldKey = getFirstFieldKey(fieldErrors);

  return {
    isValid: firstFieldKey === "",
    fieldErrors,
    firstError: firstFieldKey ? fieldErrors[firstFieldKey] : "",
  };
}

function buildRecord(data) {
  const now = new Date();

  return {
    recordId: createRecordId(),
    timestampIso: now.toISOString(),
    timestampDisplay: now.toLocaleString(),
    updatedAtIso: "",
    machine: data.machine,
    operator: data.operator,
    shift: data.shift,
    temp: data.temp,
    pressure: data.pressure,
    status: data.status,
  };
}

function normalizeComparableText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isPotentialDuplicate(record, data) {
  return (
    normalizeComparableText(record.machine) === normalizeComparableText(data.machine) &&
    normalizeComparableText(record.operator) === normalizeComparableText(data.operator) &&
    normalizeShift(record.shift) === data.shift &&
    Number(record.temp) === Number(data.temp) &&
    Number(record.pressure) === Number(data.pressure) &&
    normalizeStatus(record.status) === data.status
  );
}

function findDuplicateRecord(records, data, excludeRecordId) {
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (excludeRecordId && record.recordId === excludeRecordId) {
      continue;
    }

    if (isPotentialDuplicate(record, data)) {
      return record;
    }
  }

  return null;
}

function confirmDuplicateSave(duplicateRecord) {
  const duplicateTimestamp = getDisplayTimestamp(duplicateRecord);
  const duplicateMessage = "Potential duplicate detected. Existing record time: " + duplicateTimestamp + ". Save anyway?";
  return window.confirm(duplicateMessage);
}

function findRecordIndexById(records, recordId) {
  return records.findIndex(function(record) {
    return record.recordId === recordId;
  });
}

function enterEditMode(recordId) {
  const savedRecords = getSavedRecords();
  const targetRecord = savedRecords.find(function(record) {
    return record.recordId === recordId;
  });

  if (!targetRecord) {
    showMessage("Record not found for editing.", true);
    return;
  }

  machineIdInput.value = String(targetRecord.machine ?? "");
  operatorIdInput.value = String(targetRecord.operator ?? "");
  shiftInput.value = normalizeShift(targetRecord.shift || "A");
  tempInput.value = String(targetRecord.temp ?? "");
  pressureInput.value = String(targetRecord.pressure ?? "");
  statusInput.value = normalizeStatus(targetRecord.status || "OK");

  updateStatusPreview();

  editRecordId = recordId;
  setEditMode(true);
  clearFieldErrors();
  showMessage("Editing selected record. Update values and click Update Record.", false);
  machineIdInput.focus();
}

function deleteRecord(recordId) {
  const savedRecords = getSavedRecords();
  const recordIndex = findRecordIndexById(savedRecords, recordId);
  if (recordIndex === -1) {
    showMessage("Record not found for delete.", true);
    return;
  }

  const targetRecord = savedRecords[recordIndex];
  const shouldDelete = window.confirm("Delete this record for machine " + String(targetRecord.machine ?? "") + "?");
  if (!shouldDelete) {
    showMessage("Delete action cancelled.", false);
    return;
  }

  setUndoState(targetRecord, recordIndex);
  savedRecords.splice(recordIndex, 1);
  if (!saveRecords(savedRecords)) {
    return;
  }

  if (editRecordId === recordId) {
    form.reset();
    exitEditMode();
  }

  renderRecords();
  showMessage("Record deleted. Click Undo Last Delete to restore it.", false);
}

function undoLastDelete() {
  if (!lastDeletedRecordState) {
    showMessage("No delete action to undo.", false);
    return;
  }

  const savedRecords = getSavedRecords();
  const restoredRecord = { ...lastDeletedRecordState.record };

  const hasSameId = savedRecords.some(function(record) {
    return record.recordId === restoredRecord.recordId;
  });
  if (hasSameId) {
    restoredRecord.recordId = createRecordId();
  }

  const targetIndex = Math.max(0, Math.min(lastDeletedRecordState.index, savedRecords.length));
  savedRecords.splice(targetIndex, 0, restoredRecord);

  if (!saveRecords(savedRecords)) {
    return;
  }

  clearUndoState();
  renderRecords();
  showMessage("Delete undone successfully.", false);
}

function getTimestampSortValue(record) {
  if (record.timestampIso) {
    const parsedDate = new Date(record.timestampIso);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.getTime();
    }
  }

  if (record.timestamp) {
    const parsedLegacyDate = new Date(record.timestamp);
    if (!Number.isNaN(parsedLegacyDate.getTime())) {
      return parsedLegacyDate.getTime();
    }
  }

  return 0;
}

function getSortValue(record, sortKey) {
  if (sortKey === "timestamp") return getTimestampSortValue(record);
  if (sortKey === "temp") return Number(record.temp);
  if (sortKey === "pressure") return Number(record.pressure);
  if (sortKey === "status") return STATUS_SORT_ORDER[record.status] || 99;
  return 0;
}

function sortRecords(records) {
  const sortedRecords = records.slice();
  const directionFactor = sortState.direction === SORT_ASC ? 1 : -1;

  sortedRecords.sort(function(a, b) {
    const valueA = getSortValue(a, sortState.key);
    const valueB = getSortValue(b, sortState.key);

    if (valueA < valueB) return -1 * directionFactor;
    if (valueA > valueB) return 1 * directionFactor;
    return 0;
  });

  return sortedRecords;
}

function getSortButtonLabel(sortKey) {
  if (sortKey === "timestamp") return "Timestamp";
  if (sortKey === "temp") return "Temperature";
  if (sortKey === "pressure") return "Pressure";
  if (sortKey === "status") return "Status";
  return "Column";
}

function updateSortIndicators() {
  sortButtons.forEach(function(button) {
    const buttonSortKey = button.getAttribute("data-sort-key");
    const th = button.closest("th");
    const indicator = button.querySelector(".sort-indicator");

    if (buttonSortKey === sortState.key) {
      const isAscending = sortState.direction === SORT_ASC;
      indicator.innerText = isAscending ? "ASC" : "DESC";
      button.setAttribute("aria-pressed", "true");
      button.setAttribute("aria-label", "Sort by " + getSortButtonLabel(buttonSortKey) + (isAscending ? " descending" : " ascending"));
      if (th) th.setAttribute("aria-sort", isAscending ? "ascending" : "descending");
      return;
    }

    indicator.innerText = "SORT";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Sort by " + getSortButtonLabel(buttonSortKey));
    if (th) th.setAttribute("aria-sort", "none");
  });
}

function getInitialSortDirection(sortKey) {
  if (sortKey === "timestamp") return SORT_DESC;
  return SORT_ASC;
}

function applySort(sortKey) {
  if (sortState.key === sortKey) {
    sortState.direction = sortState.direction === SORT_ASC ? SORT_DESC : SORT_ASC;
  } else {
    sortState.key = sortKey;
    sortState.direction = getInitialSortDirection(sortKey);
  }

  updateSortIndicators();
  renderRecords();
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase();
}

function matchesSearch(record, searchText) {
  if (!searchText) return true;

  const searchableParts = [
    getDisplayTimestamp(record),
    record.machine,
    record.operator,
    record.shift,
    record.temp,
    record.pressure,
    record.status,
  ];

  return searchableParts.some(function(part) {
    return normalizeText(part).includes(searchText);
  });
}

function getFilteredRecords(records) {
  const searchText = normalizeText(searchFilter.value.trim());
  const selectedShift = shiftFilter.value;
  const selectedStatus = statusFilter.value;

  return records.filter(function(record) {
    const searchMatches = matchesSearch(record, searchText);
    const shiftMatches = selectedShift === FILTER_ALL || record.shift === selectedShift;
    const statusMatches = selectedStatus === FILTER_ALL || record.status === selectedStatus;
    return searchMatches && shiftMatches && statusMatches;
  });
}

function getVisibleRecords(records) {
  return sortRecords(getFilteredRecords(records));
}

function updateEmptyState(totalCount, visibleCount) {
  if (visibleCount > 0) {
    emptyState.hidden = true;
    return;
  }

  emptyState.hidden = false;
  emptyState.innerText = totalCount === 0
    ? "No records yet. Submit the form to add machine readings."
    : "No records match current search or filters.";
}

function updateSummaryCards(records) {
  if (!summaryTotal || !summaryOk || !summaryWarning || !summaryCritical) {
    return;
  }

  let okCount = 0;
  let warningCount = 0;
  let criticalCount = 0;

  records.forEach(function(record) {
    if (record.status === "OK") {
      okCount += 1;
      return;
    }

    if (record.status === "Warning") {
      warningCount += 1;
      return;
    }

    if (record.status === "Critical") {
      criticalCount += 1;
    }
  });

  summaryTotal.innerText = String(records.length);
  summaryOk.innerText = String(okCount);
  summaryWarning.innerText = String(warningCount);
  summaryCritical.innerText = String(criticalCount);
}

function updateTrendSection(records) {
  if (!trendMeta || !trendList) {
    return;
  }

  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();

  const hourlyCounts = Array.from({ length: 24 }, function() {
    return { total: 0, critical: 0 };
  });

  records.forEach(function(record) {
    const recordDate = getRecordDate(record);
    if (!recordDate) {
      return;
    }

    const isToday =
      recordDate.getFullYear() === todayYear &&
      recordDate.getMonth() === todayMonth &&
      recordDate.getDate() === todayDate;
    if (!isToday) {
      return;
    }

    const hour = recordDate.getHours();
    hourlyCounts[hour].total += 1;
    if (record.status === "Critical") {
      hourlyCounts[hour].critical += 1;
    }
  });

  const activeHours = [];
  for (let hour = 0; hour < hourlyCounts.length; hour += 1) {
    if (hourlyCounts[hour].total > 0) {
      activeHours.push({
        hour,
        total: hourlyCounts[hour].total,
        critical: hourlyCounts[hour].critical,
      });
    }
  }

  trendList.innerHTML = "";

  if (activeHours.length === 0) {
    trendMeta.innerText = "No readings for today yet.";
    return;
  }

  trendMeta.innerText = "Showing visible records grouped by hour (today).";

  activeHours.forEach(function(item) {
    const trendLine = document.createElement("p");
    trendLine.className = "trend-item";

    const startHour = String(item.hour).padStart(2, "0");
    const endHour = String((item.hour + 1) % 24).padStart(2, "0");
    trendLine.innerText = startHour + ":00-" + endHour + ":00 total " + item.total + " critical " + item.critical;
    trendList.appendChild(trendLine);
  });
}

function renderRecords() {
  if (!tableBody) {
    showMessage("UI error: table body not found.", true);
    return;
  }

  try {
    const records = getSavedRecords();
    const visibleRecords = getVisibleRecords(records);

    tableBody.innerHTML = "";
    const rowsFragment = document.createDocumentFragment();

    visibleRecords.forEach(function(record) {
      rowsFragment.appendChild(createRow(record));
    });

    tableBody.appendChild(rowsFragment);
    updateEmptyState(records.length, visibleRecords.length);
    updateSummaryCards(visibleRecords);
    updateTrendSection(visibleRecords);
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    showMessage("Render error: " + errorText, true);
  }
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return "\"" + text.replace(/\"/g, "\"\"") + "\"";
  }
  return text;
}

function createCsvContent(records) {
  const headerRow = CSV_EXPORT_COLUMNS.join(",");
  const dataRows = records.map(function(record) {
    return CSV_EXPORT_COLUMNS.map(function(columnKey) {
      return escapeCsvValue(record[columnKey]);
    }).join(",");
  });

  return [headerRow].concat(dataRows).join("\r\n");
}

function getCsvFileName() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return "shopfloor-readings-" + year + month + day + "-" + hour + minute + second + ".csv";
}

function downloadCsv(csvContent, fileName) {
  const csvBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const csvUrl = URL.createObjectURL(csvBlob);

  const link = document.createElement("a");
  link.href = csvUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(csvUrl);
}

function exportVisibleRecordsToCsv() {
  const savedRecords = getSavedRecords();
  const visibleRecords = getVisibleRecords(savedRecords);

  if (visibleRecords.length === 0) {
    showMessage("No rows to export for current search or filters.", true);
    return;
  }

  const csvContent = createCsvContent(visibleRecords);
  downloadCsv(csvContent, getCsvFileName());
  showMessage("Exported " + visibleRecords.length + " record(s) to CSV.", false);
}

function parseCsvText(csvText) {
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];

    if (char === "\"") {
      const nextChar = csvText[index + 1];
      if (inQuotes && nextChar === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && csvText[index + 1] === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function normalizeCsvHeaderKey(headerValue) {
  return String(headerValue ?? "").toLowerCase().replace(/[\s_-]/g, "");
}

function buildCsvColumnIndexMap(headerRow) {
  const columnIndexMap = {};

  headerRow.forEach(function(headerValue, index) {
    const normalizedHeader = normalizeCsvHeaderKey(headerValue);
    const mappedColumn = CSV_COLUMN_ALIASES[normalizedHeader];
    if (!mappedColumn) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(columnIndexMap, mappedColumn)) {
      return;
    }

    columnIndexMap[mappedColumn] = index;
  });

  return columnIndexMap;
}

function getCsvCellValue(row, columnIndexMap, columnName) {
  const columnIndex = columnIndexMap[columnName];
  if (columnIndex === undefined) {
    return "";
  }

  return String(row[columnIndex] ?? "").trim();
}

function getImportedTimestamp(row, columnIndexMap) {
  const csvTimestampIso = getCsvCellValue(row, columnIndexMap, "timestampIso");
  const csvTimestampDisplay = getCsvCellValue(row, columnIndexMap, "timestampDisplay");

  if (csvTimestampIso) {
    const parsedIsoDate = new Date(csvTimestampIso);
    if (!Number.isNaN(parsedIsoDate.getTime())) {
      return {
        timestampIso: parsedIsoDate.toISOString(),
        timestampDisplay: csvTimestampDisplay || parsedIsoDate.toLocaleString(),
      };
    }
  }

  if (csvTimestampDisplay) {
    const parsedDisplayDate = new Date(csvTimestampDisplay);
    if (!Number.isNaN(parsedDisplayDate.getTime())) {
      return {
        timestampIso: parsedDisplayDate.toISOString(),
        timestampDisplay: csvTimestampDisplay,
      };
    }
  }

  const now = new Date();
  return {
    timestampIso: now.toISOString(),
    timestampDisplay: csvTimestampDisplay || now.toLocaleString(),
  };
}

function getImportedUpdatedAtIso(row, columnIndexMap) {
  const csvUpdatedAtIso = getCsvCellValue(row, columnIndexMap, "updatedAtIso");
  if (!csvUpdatedAtIso) {
    return "";
  }

  const parsedUpdated = new Date(csvUpdatedAtIso);
  if (Number.isNaN(parsedUpdated.getTime())) {
    return "";
  }

  return parsedUpdated.toISOString();
}

function buildRecordFromCsvRow(row, columnIndexMap) {
  const data = {
    machine: getCsvCellValue(row, columnIndexMap, "machine"),
    operator: getCsvCellValue(row, columnIndexMap, "operator"),
    shift: normalizeShift(getCsvCellValue(row, columnIndexMap, "shift")),
    temp: Number(getCsvCellValue(row, columnIndexMap, "temp")),
    pressure: Number(getCsvCellValue(row, columnIndexMap, "pressure")),
    status: deriveStatus(
        Number(getCsvCellValue(row, columnIndexMap, "temp")),
        Number(getCsvCellValue(row, columnIndexMap, "pressure"))
    ),
  };

  const validationResult = validateFormData(data);
  if (!validationResult.isValid) {
    return null;
  }

  const importedTimestamp = getImportedTimestamp(row, columnIndexMap);
  const importedUpdatedAtIso = getImportedUpdatedAtIso(row, columnIndexMap);

  return {
    recordId: createRecordId(),
    timestampIso: importedTimestamp.timestampIso,
    timestampDisplay: importedTimestamp.timestampDisplay,
    updatedAtIso: importedUpdatedAtIso,
    machine: data.machine,
    operator: data.operator,
    shift: data.shift,
    temp: data.temp,
    pressure: data.pressure,
    status: data.status,
  };
}

async function importCsvFile(file) {
  try {
    const csvText = await file.text();
    const rows = parseCsvText(csvText);

    if (rows.length < 2) {
      showMessage("CSV must include a header row and at least one data row.", true);
      return;
    }

    const headerRow = rows[0].map(function(cellValue, index) {
      const textValue = String(cellValue ?? "");
      return index === 0 ? textValue.replace(/^\uFEFF/, "") : textValue;
    });

    const columnIndexMap = buildCsvColumnIndexMap(headerRow);
    const missingColumns = REQUIRED_IMPORT_COLUMNS.filter(function(columnName) {
      return columnIndexMap[columnName] === undefined;
    });

    if (missingColumns.length > 0) {
      showMessage("CSV is missing required columns: " + missingColumns.join(", ") + ".", true);
      return;
    }

    const savedRecords = getSavedRecords();
    let importedCount = 0;
    let skippedCount = 0;

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const hasData = row.some(function(cellValue) {
        return String(cellValue ?? "").trim() !== "";
      });

      if (!hasData) {
        continue;
      }

      const importedRecord = buildRecordFromCsvRow(row, columnIndexMap);
      if (!importedRecord) {
        skippedCount += 1;
        continue;
      }

      savedRecords.push(importedRecord);
      importedCount += 1;
    }

    if (importedCount === 0) {
      showMessage("No valid rows were imported from CSV.", true);
      return;
    }

    if (!saveRecords(savedRecords)) {
      return;
    }

    form.reset();
    exitEditMode();
    clearFieldErrors();
    renderRecords();

    const importMessage = "Imported " + importedCount + " record(s)." + (skippedCount > 0 ? " Skipped " + skippedCount + " invalid row(s)." : "");
    showMessage(importMessage, false);
  } catch {
    showMessage("CSV import failed. Check file format and try again.", true);
  } finally {
    csvFileInput.value = "";
  }
}

form.addEventListener("submit", function(e) {
  e.preventDefault();

  const formData = getFormData();
  const validationResult = validateFormData(formData);
  applyFieldErrors(validationResult.fieldErrors);
  if (!validationResult.isValid) {
    focusFirstInvalidField(validationResult.fieldErrors);
    showMessage(validationResult.firstError, true);
    return;
  }

  const savedRecords = getSavedRecords();
  const duplicateRecord = findDuplicateRecord(savedRecords, formData, editRecordId);
  if (duplicateRecord) {
    const shouldContinue = confirmDuplicateSave(duplicateRecord);
    if (!shouldContinue) {
      showMessage("Save cancelled to avoid duplicate entry.", false);
      return;
    }
  }

  if (editRecordId) {
    const recordIndex = findRecordIndexById(savedRecords, editRecordId);
    if (recordIndex === -1) {
      showMessage("Record not found for update.", true);
      form.reset();
      exitEditMode();
      return;
    }

    const existingRecord = savedRecords[recordIndex];
    savedRecords[recordIndex] = {
      ...existingRecord,
      machine: formData.machine,
      operator: formData.operator,
      shift: formData.shift,
      temp: formData.temp,
      pressure: formData.pressure,
      status: formData.status,
      updatedAtIso: new Date().toISOString(),
    };

    if (!saveRecords(savedRecords)) {
      return;
    }

    clearFieldErrors();
    form.reset();
    updateStatusPreview();
    exitEditMode();
    renderRecords();
    showMessage("Record updated successfully.", false);
    return;
  }

  const record = buildRecord(formData);
  savedRecords.push(record);
  if (!saveRecords(savedRecords)) {
    return;
  }

  clearFieldErrors();
  form.reset();
  updateStatusPreview();
  renderRecords();
  showMessage("Data submitted successfully.", false);
});

clearDataBtn.addEventListener("click", function() {
  const savedRecords = getSavedRecords();
  if (savedRecords.length === 0) {
    showMessage("No saved data to clear.", false);
    return;
  }

  const shouldClear = window.confirm("This will delete all saved records. Continue?");
  if (!shouldClear) {
    showMessage("Clear action cancelled.", false);
    return;
  }

  if (useInMemoryStorage) {
    inMemoryRecords = [];
  } else {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      showMessage("Could not clear saved data.", true);
      return;
    }
  }

  form.reset();
  updateStatusPreview();
  exitEditMode();
  clearFieldErrors();
  clearUndoState();
  renderRecords();

  showMessage("All saved data cleared.", false);
});

undoDeleteBtn.addEventListener("click", function() {
  undoLastDelete();
});

cancelEditBtn.addEventListener("click", function() {
  form.reset();
  updateStatusPreview();
  exitEditMode();
  clearFieldErrors();
  showMessage("Edit cancelled.", false);
});

machineIdInput.addEventListener("input", function() {
  clearFieldError("machine");
});

operatorIdInput.addEventListener("input", function() {
  clearFieldError("operator");
});

shiftInput.addEventListener("change", function() {
  clearFieldError("shift");
});

tempInput.addEventListener("input", function() {
  clearFieldError("temp");
});

pressureInput.addEventListener("input", function() {
  clearFieldError("pressure");
});

statusInput.addEventListener("change", function() {
  clearFieldError("status");
});

searchFilter.addEventListener("input", function() {
  renderRecords();
});

shiftFilter.addEventListener("change", function() {
  renderRecords();
});

statusFilter.addEventListener("change", function() {
  renderRecords();
});

resetFiltersBtn.addEventListener("click", function() {
  searchFilter.value = "";
  shiftFilter.value = FILTER_ALL;
  statusFilter.value = FILTER_ALL;
  renderRecords();
});

sortButtons.forEach(function(button) {
  button.addEventListener("click", function() {
    const sortKey = button.getAttribute("data-sort-key");
    applySort(sortKey);
  });
});

tableBody.addEventListener("click", function(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const actionButton = event.target.closest(".action-btn");
  if (!actionButton) {
    return;
  }

  const action = actionButton.getAttribute("data-action");
  const recordId = actionButton.getAttribute("data-record-id");

  if (!recordId) {
    showMessage("Action failed: missing record id.", true);
    return;
  }

  if (action === "edit") {
    enterEditMode(recordId);
    return;
  }

  if (action === "delete") {
    deleteRecord(recordId);
  }
});

exportCsvBtn.addEventListener("click", function() {
  exportVisibleRecordsToCsv();
});

importCsvBtn.addEventListener("click", function() {
  csvFileInput.click();
});

csvFileInput.addEventListener("change", function() {
  const selectedFile = csvFileInput.files && csvFileInput.files[0];
  if (!selectedFile) {
    return;
  }

  importCsvFile(selectedFile);
});

tempInput.addEventListener("input", updateStatusPreview);
pressureInput.addEventListener("input", updateStatusPreview);

setEditMode(false);
clearFieldErrors();
updateUndoButtonState();
updateSortIndicators();
renderRecords();
updateStatusPreview();