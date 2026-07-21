import { lazy, Suspense, useEffect, useState } from "react";
import AdminPage from "./AdminPage.jsx";
import { apiFetch } from "./api.js";
import AssetStickerPage from "./AssetStickerPage.jsx";
import { useAuthUser } from "./AuthGate.jsx";
import { authEnabled } from "./authConfig.js";
import InventoryDetailPage from "./InventoryDetailPage.jsx";
import ItInventoryPage from "./ItInventoryPage.jsx";
import OpenTicketPage from "./OpenTicketPage.jsx";

const ScanPage = lazy(() => import("./ScanPage.jsx"));

const authDisabled =
  String(import.meta.env.VITE_AUTH_DISABLED || "").toLowerCase() === "true";

function parseInventoryHash(hash) {
  const match = hash.match(/^#\/inventory\/(.+)$/);
  if (!match) return null;

  const [route, query = ""] = match[1].split("?", 2);
  const fromScan = new URLSearchParams(query).get("from") === "scan";
  const parts = route.split("/").map((part) => decodeURIComponent(part));
  if (!/^\d+$/.test(parts[0])) return null;

  const categoryId = Number(parts[0]);

  if (parts.length === 1) {
    return { name: "inventory-list", categoryId };
  }

  if (parts.length === 2 && parts[1] === "new") {
    return { name: "inventory-new", categoryId };
  }

  if (parts.length === 2 && /^\d+$/.test(parts[1])) {
    return {
      name: "inventory-detail",
      categoryId,
      id: Number(parts[1]),
      startInEditMode: false,
      fromScan,
    };
  }

  if (parts.length === 3 && /^\d+$/.test(parts[1]) && parts[2] === "edit") {
    return {
      name: "inventory-detail",
      categoryId,
      id: Number(parts[1]),
      startInEditMode: true,
    };
  }

  if (parts.length === 3 && /^\d+$/.test(parts[1]) && parts[2] === "sticker") {
    return {
      name: "asset-sticker",
      categoryId,
      id: Number(parts[1]),
    };
  }

  if (parts.length === 3 && /^\d+$/.test(parts[1]) && parts[2] === "ticket") {
    return {
      name: "open-ticket",
      categoryId,
      id: Number(parts[1]),
    };
  }

  return null;
}

function getPageFromHash() {
  const hash = window.location.hash;

  if (hash === "#/admin") return { name: "admin" };
  if (hash === "#/scan") return { name: "scan" };

  const inventoryPage = parseInventoryHash(hash);
  if (inventoryPage) return inventoryPage;

  return { name: "home" };
}

function SignOutButton() {
  const { name, signOut } = useAuthUser();
  return (
    <button type="button" className="secondary" onClick={signOut}>
      {name ? `Sign out (${name})` : "Sign out"}
    </button>
  );
}

function HomePage() {
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState(null);
  const [me, setMe] = useState(null);
  const [meError, setMeError] = useState(null);

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
          setCategoriesError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setCategories([]);
          setCategoriesError(err.message || "Failed to load categories");
        }
      }
    }

    async function loadMe() {
      if (authDisabled || !authEnabled) {
        if (!cancelled) {
          setMe({
            name: null,
            preferredUsername: null,
            roles: [],
            authDisabled: true,
          });
        }
        return;
      }

      try {
        const response = await apiFetch("/api/me");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.detail
              ? `${data.error || "Unauthorized"}: ${data.detail}`
              : data.error || "Failed to load /api/me"
          );
        }
        if (!cancelled) {
          setMe(data);
          setMeError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setMe(null);
          setMeError(err.message || "Failed to load /api/me");
        }
      }
    }

    loadCategories();
    loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = me?.name || me?.preferredUsername || "(unknown)";
  const roles =
    me?.roles?.length > 0 ? me.roles.join(", ") : "(none in token)";
  const roleSet = new Set(
    (Array.isArray(me?.roles) ? me.roles : []).map((role) =>
      String(role).toLowerCase()
    )
  );
  const isAdmin =
    me?.authDisabled ||
    roleSet.has("inventory.admin") ||
    roleSet.has("inventorydb.admin");
  const isEditor =
    roleSet.has("inventory.editor") ||
    roleSet.has("inventorydb.editor");
  const canAccessInventory = isAdmin || isEditor;

  return (
    <div className="app home">
      <header className="header">
        <h1>InventoryDB</h1>
      </header>

      {categoriesError && (
        <div className="banner error">{categoriesError}</div>
      )}

      <nav className="home-nav" aria-label="Inventory sections">
        {canAccessInventory
          ? categories.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  window.location.hash = `#/inventory/${row.id}`;
                }}
              >
                {row.category}
              </button>
            ))
          : null}
        {canAccessInventory ? (
          <button
            type="button"
            className="scan-button"
            onClick={() => {
              window.location.hash = "#/scan";
            }}
          >
            Scan
          </button>
        ) : null}
        {isAdmin ? (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              window.location.hash = "#/admin";
            }}
          >
            Administration
          </button>
        ) : null}
        {!authDisabled && authEnabled ? <SignOutButton /> : null}
      </nav>

      <p className="muted" style={{ marginTop: "2rem", fontSize: "0.85rem" }}>
        DEBUG — user: {meError ? `error (${meError})` : displayName}
        {" · "}
        roles: {meError ? "—" : me?.authDisabled ? "(auth disabled)" : roles}
      </p>
    </div>
  );
}

function useCategory(categoryId) {
  const [category, setCategory] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(`/api/categories/${categoryId}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load category");
        }
        if (!cancelled) {
          setCategory(data);
        }
      } catch (err) {
        if (!cancelled) {
          setCategory(null);
          setError(err.message || "Failed to load category");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  return { category, error, loading };
}

function CategoryRoute({ categoryId, children }) {
  const { category, error, loading } = useCategory(categoryId);

  if (loading) {
    return (
      <div className="app">
        <p className="muted">Loading category…</p>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="app">
        <div className="banner error">{error || "Category not found"}</div>
        <button type="button" className="secondary" onClick={() => {
          window.location.hash = "";
        }}>
          ← Home
        </button>
      </div>
    );
  }

  return children(category);
}

export default function App() {
  const [page, setPage] = useState(getPageFromHash);

  useEffect(() => {
    function onHashChange() {
      setPage(getPageFromHash());
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function goHome() {
    window.location.hash = "";
  }

  function inventoryPath(categoryId, ...parts) {
    return `#/inventory/${[categoryId, ...parts].join("/")}`;
  }

  if (page.name === "admin") {
    return <AdminPage onBack={goHome} />;
  }

  if (page.name === "scan") {
    return (
      <Suspense
        fallback={
          <div className="app">
            <p className="muted">Loading scanner…</p>
          </div>
        }
      >
        <ScanPage onBack={goHome} />
      </Suspense>
    );
  }

  if (page.name === "asset-sticker") {
    return (
      <CategoryRoute categoryId={page.categoryId}>
        {(category) => (
          <AssetStickerPage
            id={page.id}
            categoryId={category.id}
          />
        )}
      </CategoryRoute>
    );
  }

  if (page.name === "open-ticket") {
    return (
      <CategoryRoute categoryId={page.categoryId}>
        {(category) => (
          <OpenTicketPage
            id={page.id}
            categoryId={category.id}
          />
        )}
      </CategoryRoute>
    );
  }

  if (page.name === "inventory-new") {
    return (
      <CategoryRoute categoryId={page.categoryId}>
        {(category) => (
          <InventoryDetailPage
            isNew
            categoryId={category.id}
            category={category.category}
            listTitle={category.category}
            startInEditMode
            onBack={() => {
              window.location.hash = inventoryPath(category.id);
            }}
            onCreated={(id) => {
              window.location.hash = inventoryPath(category.id, id);
            }}
          />
        )}
      </CategoryRoute>
    );
  }

  if (page.name === "inventory-detail") {
    return (
      <CategoryRoute categoryId={page.categoryId}>
        {(category) => (
          <InventoryDetailPage
            id={page.id}
            categoryId={category.id}
            category={category.category}
            listTitle={category.category}
            backLabel={page.fromScan ? "Scan" : category.category}
            startInEditMode={page.startInEditMode}
            onBack={() => {
              window.location.hash = page.fromScan
                ? "#/scan"
                : inventoryPath(category.id);
            }}
          />
        )}
      </CategoryRoute>
    );
  }

  if (page.name === "inventory-list") {
    return (
      <CategoryRoute categoryId={page.categoryId}>
        {(category) => (
          <ItInventoryPage
            categoryId={category.id}
            title={category.category}
            onBack={goHome}
            onEdit={(id) => {
              window.location.hash = inventoryPath(category.id, id);
            }}
            onAdd={() => {
              window.location.hash = inventoryPath(category.id, "new");
            }}
          />
        )}
      </CategoryRoute>
    );
  }

  return <HomePage />;
}
