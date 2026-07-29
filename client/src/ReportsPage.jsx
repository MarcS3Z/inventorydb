import { useEffect, useState } from "react";
import { apiFetch } from "./api.js";

const STATUS_OPTIONS = ["In Use", "Available", "Removed"];

const AGING_OPTIONS = [
  { value: "", label: "All ages" },
  { value: "gt6m", label: "Greater than 6 months" },
  { value: "gt1y", label: "Greater than 1 year" },
];

export default function ReportsPage({ onBack }) {
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [aging, setAging] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFilters() {
      try {
        const [categoriesResponse, locationsResponse] = await Promise.all([
          apiFetch("/api/categories"),
          apiFetch("/api/locations"),
        ]);
        const categoriesData = await categoriesResponse.json();
        const locationsData = await locationsResponse.json();

        if (!categoriesResponse.ok) {
          throw new Error(categoriesData.error || "Failed to load categories");
        }
        if (!locationsResponse.ok) {
          throw new Error(locationsData.error || "Failed to load locations");
        }

        if (!cancelled) {
          setCategories(categoriesData);
          setLocations(locationsData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load report filters");
        }
      }
    }

    loadFilters();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDownload() {
    setExporting(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (categoryId) params.set("categoryId", categoryId);
      if (status) params.set("status", status);
      if (location) params.set("location", location);
      if (aging) params.set("aging", aging);

      const query = params.toString();
      const response = await apiFetch(
        `/api/inventory/export${query ? `?${query}` : ""}`
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download report");
      }

      const blob = await response.blob();
      const selectedCategory = categories.find(
        (category) => String(category.id) === categoryId
      );
      const agingLabel =
        AGING_OPTIONS.find((option) => option.value === aging)?.label || null;
      const fallbackName = [
        selectedCategory?.category || "all-categories",
        status || null,
        location || null,
        agingLabel || null,
        "inventory",
      ]
        .filter(Boolean)
        .join("-")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const disposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/i);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameMatch?.[1] || `${fallbackName}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Failed to download report");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <button type="button" className="secondary back-button" onClick={onBack}>
          ← Home
        </button>
        <h1>Reports</h1>
        <p>Filter inventory data and download a CSV report.</p>
      </header>

      {error && <div className="banner error">{error}</div>}

      <section className="panel">
        <h2>Find &amp; filter</h2>
        <form
          className="filter-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleDownload();
          }}
        >
          <label>
            Inventory
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={exporting}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.category}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              disabled={exporting}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            Location
            {locations.length > 0 ? (
              <select
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                disabled={exporting}
              >
                <option value="">All locations</option>
                {locations.map((row) => (
                  <option key={row.id} value={row.shortcode}>
                    {row.shortcode} — {row.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Location shortcode"
                disabled={exporting}
              />
            )}
          </label>

          <label>
            Aging
            <select
              value={aging}
              onChange={(event) => setAging(event.target.value)}
              disabled={exporting}
            >
              {AGING_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="filter-actions">
            <button type="submit" disabled={exporting}>
              {exporting ? "Downloading…" : "Download CSV"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
