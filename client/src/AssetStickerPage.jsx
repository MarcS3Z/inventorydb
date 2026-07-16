import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function AssetStickerPage({ id, category }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const assetUrl = useMemo(() => {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#/inventory/${category}/${id}`;
  }, [category, id]);

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

  return (
    <div className="app sticker-page">
      <header className="header sticker-header no-print">
        <h1>Asset Sticker</h1>
        <p>Scan the QR code to open this asset record.</p>
        <div className="actions">
          <button type="button" onClick={() => window.print()}>
            Print
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => window.close()}
          >
            Close
          </button>
        </div>
      </header>

      {error && <div className="banner error">{error}</div>}

      {loading ? (
        <p className="muted">Loading sticker…</p>
      ) : item ? (
        <section className="sticker-card panel">
          <QRCodeSVG value={assetUrl} size={220} level="M" includeMargin />
          <div className="sticker-meta">
            <div className="sticker-asset-id">{item.assetId}</div>
            <div className="sticker-type">{item.type || "—"}</div>
          </div>
          <p className="muted sticker-url no-print">{assetUrl}</p>
        </section>
      ) : null}
    </div>
  );
}
