import { useEffect, useRef, useState } from "react";
import { apiFetch } from "./api.js";

export default function AdminPage({ onBack }) {
  const fileInputRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [exportCategoryId, setExportCategoryId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [exportError, setExportError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const response = await apiFetch("/api/categories");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load categories");
        }
        if (!cancelled) {
          setCategories(data);
          if (data.length === 1) {
            setCategoryId(String(data[0].id));
            setExportCategoryId(String(data[0].id));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load categories");
        }
      }
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setResult(null);
    setError(null);
  }

  async function handleImport() {
    if (!categoryId) {
      setError("Choose an inventory category.");
      return;
    }
    if (!selectedFile) {
      setError("Choose a CSV file to import.");
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const csv = await selectedFile.text();
      const response = await apiFetch("/api/inventory/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, categoryId: Number(categoryId) }),
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

  async function handleExport() {
    if (!exportCategoryId) {
      setExportError("Choose an inventory category.");
      return;
    }

    setExporting(true);
    setExportError(null);

    try {
      const response = await apiFetch(
        `/api/inventory/export?categoryId=${encodeURIComponent(exportCategoryId)}`
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }

      const blob = await response.blob();
      const selectedCategory = categories.find(
        (category) => String(category.id) === exportCategoryId
      );
      const fallbackName = `${(selectedCategory?.category || "inventory")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-inventory.csv`;
      const disposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/i);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameMatch?.[1] || fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message || "Export failed");
    } finally {
      setExporting(false);
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
          Check In. Existing asset IDs are updated; new IDs are created. All
          imported records are assigned to the selected category.
        </p>

        <div className="import-actions">
          <label>
            <span className="record-label">Inventory category</span>
            <select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setResult(null);
                setError(null);
              }}
              disabled={importing}
            >
              <option value="">Select a category…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.category}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || !categoryId || !selectedFile}
          >
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

      <section className="panel">
        <h2>Export inventory CSV</h2>
        <p className="muted import-help">
          Download all inventory records assigned to a selected category.
        </p>

        <div className="import-actions">
          <label>
            <span className="record-label">Inventory category</span>
            <select
              value={exportCategoryId}
              onChange={(event) => {
                setExportCategoryId(event.target.value);
                setExportError(null);
              }}
              disabled={exporting}
            >
              <option value="">Select a category…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.category}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || !exportCategoryId}
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        {exportError && <div className="banner error">{exportError}</div>}
      </section>
    </div>
  );
}
