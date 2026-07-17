import { useEffect, useState } from "react";

export default function OpenTicketPage({ id, category }) {
  const [item, setItem] = useState(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadItem() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/inventory/${id}`);
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
    window.location.hash = `#/inventory/${encodeURIComponent(category)}/${id}`;
  }

  function handleSubmit(event) {
    event.preventDefault();
    // Submit functionality will be added later.
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
                />
              </label>
            </div>

            <div className="actions record-actions">
              <button type="submit">Submit</button>
              <button
                type="button"
                className="secondary"
                onClick={returnToAsset}
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
