import { useEffect, useState } from "react";
import { apiFetch } from "./api.js";

function formatLogDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export default function AssetLogPage({ id, categoryId }) {
  const [assetId, setAssetId] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLog() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(`/api/inventory/${id}/log`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load asset log");
        }
        if (!cancelled) {
          setAssetId(data.assetId);
          setEntries(Array.isArray(data.entries) ? data.entries : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load asset log");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLog();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function returnToAsset() {
    window.location.hash = `#/inventory/${categoryId}/${id}`;
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
        <h1>Asset Log</h1>
        <p>
          {assetId
            ? `History for asset ${assetId}.`
            : "History for this inventory asset."}
        </p>
      </header>

      {error && <div className="banner error">{error}</div>}

      <section className="panel">
        {loading ? (
          <p className="muted">Loading log…</p>
        ) : entries.length === 0 ? (
          <p className="muted">No log entries for this asset.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Asset ID</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatLogDate(entry.date)}</td>
                    <td>{entry.userName || "—"}</td>
                    <td>{entry.assetId || "—"}</td>
                    <td>{entry.message || "—"}</td>
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
