const HEADER_MAP = {
  id: "assetId",
  assetid: "assetId",
  "asset id": "assetId",
  category: "category",
  manufacturer: "manufacturer",
  type: "type",
  issued: "issued",
  location: "location",
  lastname: "lastName",
  "last name": "lastName",
  firstname: "firstName",
  "first name": "firstName",
  notes: "notes",
  status: "status",
  lastcheckin: "lastCheckIn",
  "last check in": "lastCheckIn",
  "last check-in": "lastCheckIn",
};

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || (char === "\r" && next === "\n")) {
      row.push(cell);
      if (row.some((value) => String(value).trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
      if (char === "\r") i += 1;
    } else if (char === "\r") {
      row.push(cell);
      if (row.some((value) => String(value).trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

function emptyToNull(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "?" || trimmed.toLowerCase() === "n/a") {
    return null;
  }
  return trimmed;
}

function parseDate(value) {
  const raw = emptyToNull(value);
  if (!raw) return null;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 80000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      return new Date(excelEpoch + serial * 86400000);
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function parseInventoryCsv(csvText) {
  if (!csvText || !String(csvText).trim()) {
    throw new Error("CSV content is empty");
  }

  const table = parseCsv(String(csvText).replace(/^\uFEFF/, ""));
  if (table.length < 2) {
    throw new Error("CSV must include a header row and at least one data row");
  }

  const headers = table[0].map(normalizeHeader);
  const fieldIndexes = {};

  headers.forEach((header, index) => {
    const field = HEADER_MAP[header];
    if (field) {
      fieldIndexes[field] = index;
    }
  });

  if (fieldIndexes.assetId == null) {
    throw new Error('CSV must include an "ID" column');
  }

  const rows = [];
  const errors = [];

  for (let i = 1; i < table.length; i += 1) {
    const lineNumber = i + 1;
    const cells = table[i];
    const assetId = emptyToNull(cells[fieldIndexes.assetId]);

    if (!assetId) {
      errors.push({ line: lineNumber, error: "Missing ID" });
      continue;
    }

    const get = (field) => {
      const index = fieldIndexes[field];
      return index == null ? null : emptyToNull(cells[index]);
    };

    rows.push({
      assetId,
      category: get("category"),
      manufacturer: get("manufacturer"),
      type: get("type"),
      issued: parseDate(get("issued")),
      location: get("location"),
      lastName: get("lastName"),
      firstName: get("firstName"),
      notes: get("notes"),
      status: get("status"),
      lastCheckIn: parseDate(get("lastCheckIn")),
      line: lineNumber,
    });
  }

  return { rows, errors };
}
