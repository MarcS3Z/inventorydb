import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api.js";

const STATUS_OPTIONS = ["In Use", "Available", "Removed"];

const emptyFilters = {
  assetId: "",
  status: "",
  location: "",
  name: "",
};

function formatIssuedTo(lastName, firstName) {
  const last = lastName?.trim() ?? "";
  const first = firstName?.trim() ?? "";
  if (!last && !first) return "—";
  return `${last}, ${first}`;
}

function sortValue(item, key) {
  switch (key) {
    case "assetId":
      return item.assetId ?? "";
    case "type":
      return item.type ?? "";
    case "status":
      return item.status ?? "";
    case "location":
      return item.location ?? "";
    case "issuedTo":
      return formatIssuedTo(item.lastName, item.firstName);
    default:
      return "";
  }
}

function SortableHeader({ label, column, sort, onSort }) {
  const active = sort.key === column;
  const ariaSort = active
    ? sort.direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th aria-sort={ariaSort}>
      <button
        type="button"
        className={`sort-header${active ? " active" : ""}`}
        onClick={() => onSort(column)}
      >
        <span>{label}</span>
        <span className="sort-indicator" aria-hidden="true">
          {active ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

export default function ItInventoryPage({
  categoryId,
  title,
  onBack,
  onEdit,
  onAdd,
}) {
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [sort, setSort] = useState({ key: "assetId", direction: "asc" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLocations() {
      try {
        const response = await apiFetch("/api/locations");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load locations");
        }
        if (!cancelled) {
          setLocations(data);
        }
      } catch (err) {
        console.error(err);
      }
    }

    loadLocations();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ categoryId: String(categoryId) });
        if (appliedFilters.assetId.trim()) {
          params.set("assetId", appliedFilters.assetId.trim());
        }
        if (appliedFilters.status.trim()) {
          params.set("status", appliedFilters.status.trim());
        }
        if (appliedFilters.location.trim()) {
          params.set("location", appliedFilters.location.trim());
        }
        if (appliedFilters.name.trim()) {
          params.set("name", appliedFilters.name.trim());
        }

        const response = await apiFetch(`/api/inventory?${params}`);
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
  }, [categoryId, appliedFilters]);

  const sortedItems = useMemo(() => {
    const next = [...items];
    const direction = sort.direction === "asc" ? 1 : -1;
    next.sort((a, b) => {
      const left = String(sortValue(a, sort.key)).toLocaleLowerCase();
      const right = String(sortValue(b, sort.key)).toLocaleLowerCase();
      return left.localeCompare(right, undefined, { numeric: true }) * direction;
    });
    return next;
  }, [items, sort]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    setAppliedFilters({ ...filters });
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  }

  function toggleSort(column) {
    setSort((current) => {
      if (current.key === column) {
        return {
          key: column,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key: column, direction: "asc" };
    });
  }

  function addRecord() {
    onAdd();
  }

  const hasActiveFilters = Boolean(
    appliedFilters.assetId ||
      appliedFilters.status ||
      appliedFilters.location ||
      appliedFilters.name
  );

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
        <h2>Find &amp; filter</h2>
        <form className="filter-form" onSubmit={applyFilters}>
          <label>
            Asset ID
            <input
              value={filters.assetId}
              onChange={(e) => updateFilter("assetId", e.target.value)}
              placeholder="Exact or partial ID"
            />
          </label>
          <label>
            Status
            <select
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value)}
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
                value={filters.location}
                onChange={(e) => updateFilter("location", e.target.value)}
              >
                <option value="">All locations</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.shortcode}>
                    {location.shortcode} — {location.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={filters.location}
                onChange={(e) => updateFilter("location", e.target.value)}
                placeholder="Location shortcode"
              />
            )}
          </label>
          <label>
            Issued to
            <input
              value={filters.name}
              onChange={(e) => updateFilter("name", e.target.value)}
              placeholder="First or last name"
            />
          </label>
          <div className="filter-actions">
            <button type="submit">Apply</button>
            <button
              type="button"
              className="secondary"
              onClick={clearFilters}
              disabled={
                !hasActiveFilters &&
                !filters.assetId &&
                !filters.status &&
                !filters.location &&
                !filters.name
              }
            >
              Clear
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        {loading ? (
          <p className="muted">Loading inventory…</p>
        ) : (
          <>
            <div className="list-toolbar">
              <button type="button" onClick={addRecord}>
                Add New
              </button>
            </div>
            {items.length === 0 ? (
              <p className="muted">
                {hasActiveFilters
                  ? "No inventory items match these filters."
                  : "No inventory items found."}
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <SortableHeader
                        label="Asset ID"
                        column="assetId"
                        sort={sort}
                        onSort={toggleSort}
                      />
                      <SortableHeader
                        label="Type"
                        column="type"
                        sort={sort}
                        onSort={toggleSort}
                      />
                      <SortableHeader
                        label="Status"
                        column="status"
                        sort={sort}
                        onSort={toggleSort}
                      />
                      <SortableHeader
                        label="Location"
                        column="location"
                        sort={sort}
                        onSort={toggleSort}
                      />
                      <SortableHeader
                        label="Issued To"
                        column="issuedTo"
                        sort={sort}
                        onSort={toggleSort}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <button
                            type="button"
                            className="asset-id-button"
                            title={`Edit ${item.assetId}`}
                            aria-label={`Edit ${item.assetId}`}
                            onClick={() => onEdit(item.id)}
                          >
                            {item.assetId}
                          </button>
                        </td>
                        <td>{item.type || "—"}</td>
                        <td>{item.status || "—"}</td>
                        <td>{item.location || "—"}</td>
                        <td>{formatIssuedTo(item.lastName, item.firstName)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
