import { useRef, useState } from "react";

export default function AdminPage({ onBack }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setResult(null);
    setError(null);
  }

  async function handleImport() {
    if (!selectedFile) {
      setError("Choose a CSV file to import.");
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const csv = await selectedFile.text();
      const response = await fetch("/api/inventory/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult(data);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="app admin">
      <header className="header">
        <button type="button" className="secondary back-button" onClick={onBack}>
          ← Home
        </button>
        <h1>LHM InventoryDB Administration</h1>
        <p>Manage inventory data and imports.</p>
      </header>

      <section className="panel">
        <h2>Import inventory CSV</h2>
        <p className="muted import-help">
          Upload a CSV with columns such as ID, Manufacturer, Type, Issued,
          Location, Last Name, First Name, Notes, Status, and Last
          Check In. Existing asset IDs are updated; new IDs are created.
        </p>

        <div className="import-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
          />
          <button type="button" onClick={handleImport} disabled={importing}>
            {importing ? "Importing…" : "Import CSV"}
          </button>
        </div>

        {selectedFile && (
          <p className="muted selected-file">Selected: {selectedFile.name}</p>
        )}

        {error && <div className="banner error">{error}</div>}

        {result && (
          <div className="banner success">
            <p>
              Import complete: {result.created} created, {result.updated}{" "}
              updated
              {result.skipped ? `, ${result.skipped} skipped` : ""}.
            </p>
            {result.errors?.length > 0 && (
              <ul className="import-errors">
                {result.errors.map((item) => (
                  <li key={`${item.line}-${item.error}`}>
                    Line {item.line}: {item.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
