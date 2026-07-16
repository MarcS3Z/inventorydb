import { useEffect, useState } from "react";

const STATUS_OPTIONS = ["In Use", "Available", "Removed"];

function formatValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }
  }
  return String(value);
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatIssuedTo(lastName, firstName) {
  const last = lastName?.trim() ?? "";
  const first = firstName?.trim() ?? "";
  if (!last && !first) return null;
  return `${last},${first}`;
}

function itemToForm(item) {
  return {
    assetId: item.assetId ?? "",
    manufacturer: item.manufacturer ?? "",
    type: item.type ?? "",
    status: item.status ?? "",
    issued: toDateInputValue(item.issued),
    lastCheckIn: toDateInputValue(item.lastCheckIn),
    location: item.location ?? "",
    lastName: item.lastName ?? "",
    firstName: item.firstName ?? "",
    notes: item.notes ?? "",
  };
}

function Field({ label, children, className }) {
  return (
    <label className={`record-field ${className ?? ""}`.trim()}>
      <span className="record-label">{label}</span>
      {children}
    </label>
  );
}

function ReadValue({ value }) {
  return <div className="record-value">{formatValue(value)}</div>;
}

export default function InventoryDetailPage({ id, listTitle = "Inventory", onBack }) {
  const [item, setItem] = useState(null);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadItem() {
      setLoading(true);
      setError(null);
      setEditing(false);
      try {
        const response = await fetch(`/api/inventory/${id}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load inventory item");
        }
        if (!cancelled) {
          setItem(data);
          setForm(itemToForm(data));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load inventory item");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadItem();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEditing() {
    if (!item) return;
    setForm(itemToForm(item));
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    if (item) {
      setForm(itemToForm(item));
    }
    setError(null);
    setEditing(false);
  }

  async function saveChanges() {
    if (!form) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update inventory item");
      }
      setItem(data);
      setForm(itemToForm(data));
      setEditing(false);
    } catch (err) {
      setError(err.message || "Failed to update inventory item");
    } finally {
      setSaving(false);
    }
  }

  async function checkIn() {
    if (!item) return;

    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      ...itemToForm(item),
      lastCheckIn: today,
    };

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to check in inventory item");
      }
      setItem(data);
      setForm(itemToForm(data));
    } catch (err) {
      setError(err.message || "Failed to check in inventory item");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord() {
    if (!item) return;

    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete inventory item");
      }
      onBack();
    } catch (err) {
      setError(err.message || "Failed to delete inventory item");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <button type="button" className="secondary back-button" onClick={onBack}>
          ← {listTitle}
        </button>
        <h1>Inventory Record</h1>
        <p>
          {item?.assetId
            ? `Asset: ${item.assetId} - ${item.type || "—"}`
            : "View full inventory details."}
        </p>
      </header>

      {error && <div className="banner error">{error}</div>}

      <section className="panel">
        {loading || !form ? (
          <p className="muted">Loading record…</p>
        ) : item ? (
          <>
            <div className="record-layout">
              <div className="record-row">
                <Field label="Asset ID">
                  {editing ? (
                    <input
                      value={form.assetId}
                      onChange={(e) => updateField("assetId", e.target.value)}
                    />
                  ) : (
                    <ReadValue value={item.assetId} />
                  )}
                </Field>
              </div>

              <div className="record-row record-row-2">
                <Field label="Manufacturer">
                  {editing ? (
                    <input
                      value={form.manufacturer}
                      onChange={(e) => updateField("manufacturer", e.target.value)}
                    />
                  ) : (
                    <ReadValue value={item.manufacturer} />
                  )}
                </Field>
                <Field label="Type">
                  {editing ? (
                    <input
                      value={form.type}
                      onChange={(e) => updateField("type", e.target.value)}
                    />
                  ) : (
                    <ReadValue value={item.type} />
                  )}
                </Field>
              </div>

              <div className="record-row">
                <Field label="Status">
                  {editing ? (
                    <select
                      value={form.status}
                      onChange={(e) => updateField("status", e.target.value)}
                    >
                      <option value="">Select status</option>
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <ReadValue value={item.status} />
                  )}
                </Field>
              </div>

              <div className="record-row record-row-2">
                <Field label="Issued">
                  {editing ? (
                    <input
                      type="date"
                      value={form.issued}
                      onChange={(e) => updateField("issued", e.target.value)}
                    />
                  ) : (
                    <ReadValue value={item.issued} />
                  )}
                </Field>
                <Field label="Last Check In">
                  {editing ? (
                    <input
                      type="date"
                      value={form.lastCheckIn}
                      onChange={(e) => updateField("lastCheckIn", e.target.value)}
                    />
                  ) : (
                    <ReadValue value={item.lastCheckIn} />
                  )}
                </Field>
              </div>

              <div className="record-row record-row-2">
                <Field label="Location">
                  {editing ? (
                    <input
                      value={form.location}
                      onChange={(e) => updateField("location", e.target.value)}
                    />
                  ) : (
                    <ReadValue value={item.location} />
                  )}
                </Field>
                {editing ? (
                  <div className="issued-to-edit">
                    <span className="record-label">Issued To</span>
                    <div className="issued-to-fields">
                      <input
                        placeholder="Last name"
                        aria-label="Last name"
                        value={form.lastName}
                        onChange={(e) => updateField("lastName", e.target.value)}
                      />
                      <input
                        placeholder="First name"
                        aria-label="First name"
                        value={form.firstName}
                        onChange={(e) => updateField("firstName", e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <Field label="Issued To">
                    <ReadValue
                      value={formatIssuedTo(item.lastName, item.firstName)}
                    />
                  </Field>
                )}
              </div>

              <div className="record-row">
                <Field label="Notes">
                  {editing ? (
                    <textarea
                      rows={4}
                      value={form.notes}
                      onChange={(e) => updateField("notes", e.target.value)}
                    />
                  ) : (
                    <ReadValue value={item.notes} />
                  )}
                </Field>
              </div>
            </div>

            <div className="actions record-actions">
              {editing ? (
                <>
                  <button type="button" onClick={saveChanges} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={cancelEditing}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </>
              ) : confirmingDelete ? (
                <div className="delete-confirm">
                  <p>
                    Delete asset <strong>{item.assetId}</strong>? This cannot be
                    undone.
                  </p>
                  <div className="actions">
                    <button
                      type="button"
                      className="danger"
                      onClick={deleteRecord}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting…" : "Confirm Delete"}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button type="button" onClick={startEditing} disabled={deleting}>
                    Update
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={deleting || saving}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={checkIn}
                    disabled={saving || deleting}
                  >
                    {saving ? "Saving…" : "Check In"}
                  </button>
                  <button type="button" className="secondary" disabled={deleting}>
                    Ticket
                  </button>
                </>
              )}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
