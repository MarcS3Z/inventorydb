import { useEffect, useState } from "react";

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export default function ItInventoryPage({ category, title, onBack, onEdit }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ category });
        const response = await fetch(`/api/inventory?${params}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load inventory");
        }
        if (!cancelled) {
          setItems(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load inventory");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInventory();
    return () => {
      cancelled = true;
    };
  }, [category]);

  return (
    <div className="app">
      <header className="header">
        <button type="button" className="secondary back-button" onClick={onBack}>
          ← Home
        </button>
        <h1>{title}</h1>
        <p>Assets tracked in the inventory database.</p>
      </header>

      {error && <div className="banner error">{error}</div>}

      <section className="panel">
        {loading ? (
          <p className="muted">Loading inventory…</p>
        ) : items.length === 0 ? (
          <p className="muted">No inventory items found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th className="actions-col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.assetId}</td>
                    <td>{item.type || "—"}</td>
                    <td>{item.location || "—"}</td>
                    <td className="actions-col">
                      <button
                        type="button"
                        className="icon-button"
                        title={`Edit ${item.assetId}`}
                        aria-label={`Edit ${item.assetId}`}
                        onClick={() => onEdit(item.id)}
                      >
                        <EditIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
