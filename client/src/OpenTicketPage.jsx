import { useEffect, useState } from "react";
import { apiFetch } from "./api.js";

export default function OpenTicketPage({ id, categoryId }) {
  const [item, setItem] = useState(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadItem() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(`/api/inventory/${id}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load inventory item");
        }
        if (!cancelled) {
          setItem(data);
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

  function returnToAsset() {
    window.location.hash = `#/inventory/${categoryId}/${id}`;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) {
      setError("Please describe the issue before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await apiFetch(`/api/inventory/${id}/ticket`, {
        method: "POST",
        body: JSON.stringify({ description: trimmed }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit ticket");
      }
      setSuccess(true);
      setDescription("");
      setTimeout(() => {
        returnToAsset();
      }, 1200);
    } catch (err) {
      setError(err.message || "Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <button
          type="button"
          className="secondary back-button"
          onClick={returnToAsset}
        >
          ← Asset
        </button>
        <h1>Open Ticket</h1>
        <p>Report an issue with this asset.</p>
      </header>

      {error && <div className="banner error">{error}</div>}
      {success && (
        <div className="banner success">Ticket submitted. Returning to asset…</div>
      )}

      <section className="panel">
        {loading ? (
          <p className="muted">Loading asset…</p>
        ) : item ? (
          <form className="ticket-form" onSubmit={handleSubmit}>
            <div className="record-layout">
              <div className="record-row record-row-2">
                <div className="record-field">
                  <span className="record-label">Asset ID</span>
                  <div className="record-value">{item.assetId}</div>
                </div>
                <div className="record-field">
                  <span className="record-label">Asset Type</span>
                  <div className="record-value">{item.type || "—"}</div>
                </div>
              </div>

              <label className="record-field">
                <span className="record-label">
                  Describe issue with this asset:
                </span>
                <textarea
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue…"
                  required
                  disabled={submitting || success}
                />
              </label>
            </div>

            <div className="actions record-actions">
              <button type="submit" disabled={submitting || success}>
                {submitting ? "Submitting…" : "Submit"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={returnToAsset}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
