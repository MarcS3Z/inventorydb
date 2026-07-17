import { useEffect, useState } from "react";
import AdminPage from "./AdminPage.jsx";
import { apiFetch } from "./api.js";
import AssetStickerPage from "./AssetStickerPage.jsx";
import { useAuthUser } from "./AuthGate.jsx";
import { authEnabled } from "./authConfig.js";
import InventoryDetailPage from "./InventoryDetailPage.jsx";
import ItInventoryPage from "./ItInventoryPage.jsx";
import OpenTicketPage from "./OpenTicketPage.jsx";

const authDisabled =
  String(import.meta.env.VITE_AUTH_DISABLED || "").toLowerCase() === "true";

const inventoryLinks = [
  { label: "IT - PTI", category: "IT - PTI" },
  { label: "IT - FND", category: "IT - FND" },
  { label: "Facilities - PTI", category: "Facilities - PTI" },
  { label: "Facilities - FND", category: "Facilities - FND" },
];

const CATEGORIES = inventoryLinks.map((link) => link.category);

const CATEGORY_TITLES = Object.fromEntries(
  inventoryLinks.map(({ category, label }) => [category, label])
);

function encodeCategory(category) {
  return encodeURIComponent(category);
}

function parseInventoryHash(hash) {
  const match = hash.match(/^#\/inventory\/(.+)$/);
  if (!match) return null;

  const parts = match[1].split("/").map((part) => decodeURIComponent(part));
  const category = CATEGORIES.find((value) => value === parts[0]);
  if (!category) return null;

  if (parts.length === 1) {
    return { name: "inventory-list", category };
  }

  if (parts.length === 2 && parts[1] === "new") {
    return { name: "inventory-new", category };
  }

  if (parts.length === 2 && /^\d+$/.test(parts[1])) {
    return {
      name: "inventory-detail",
      category,
      id: Number(parts[1]),
      startInEditMode: false,
    };
  }

  if (parts.length === 3 && /^\d+$/.test(parts[1]) && parts[2] === "edit") {
    return {
      name: "inventory-detail",
      category,
      id: Number(parts[1]),
      startInEditMode: true,
    };
  }

  if (parts.length === 3 && /^\d+$/.test(parts[1]) && parts[2] === "sticker") {
    return {
      name: "asset-sticker",
      category,
      id: Number(parts[1]),
    };
  }

  if (parts.length === 3 && /^\d+$/.test(parts[1]) && parts[2] === "ticket") {
    return {
      name: "open-ticket",
      category,
      id: Number(parts[1]),
    };
  }

  return null;
}

function getPageFromHash() {
  const hash = window.location.hash;

  if (hash === "#/admin") return { name: "admin" };

  const inventoryPage = parseInventoryHash(hash);
  if (inventoryPage) return inventoryPage;

  // Legacy hashes
  if (hash === "#/it-inventory") {
    return { name: "inventory-list", category: "IT - PTI" };
  }
  const legacyDetail = hash.match(/^#\/it-inventory\/(\d+)$/);
  if (legacyDetail) {
    return {
      name: "inventory-detail",
      category: "IT - PTI",
      id: Number(legacyDetail[1]),
    };
  }

  // Legacy category codes
  const legacyCategoryMatch = hash.match(
    /^#\/inventory\/(IT-FND|IT|PTI|FND)(?:\/(\d+)(?:\/(edit|sticker))?)?$/
  );
  if (legacyCategoryMatch) {
    const legacyMap = {
      IT: "IT - PTI",
      "IT-FND": "IT - FND",
      PTI: "Facilities - PTI",
      FND: "Facilities - FND",
    };
    const category = legacyMap[legacyCategoryMatch[1]];
    const id = legacyCategoryMatch[2]
      ? Number(legacyCategoryMatch[2])
      : undefined;
    const suffix = legacyCategoryMatch[3];

    if (!id) return { name: "inventory-list", category };
    if (suffix === "sticker") {
      return { name: "asset-sticker", category, id };
    }
    return {
      name: "inventory-detail",
      category,
      id,
      startInEditMode: suffix === "edit",
    };
  }

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
  const [me, setMe] = useState(null);
  const [meError, setMeError] = useState(null);

  useEffect(() => {
    let cancelled = false;

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

    loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = me?.name || me?.preferredUsername || "(unknown)";
  const roles =
    me?.roles?.length > 0 ? me.roles.join(", ") : "(none in token)";

  return (
    <div className="app home">
      <header className="header">
        <h1>InventoryDB</h1>
      </header>

      <nav className="home-nav" aria-label="Inventory sections">
        {inventoryLinks.map(({ label, category }) => (
          <button
            key={category}
            type="button"
            onClick={() => {
              window.location.hash = `#/inventory/${encodeCategory(category)}`;
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() => {
            window.location.hash = "#/admin";
          }}
        >
          Administration
        </button>
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

  function inventoryPath(category, ...parts) {
    return `#/inventory/${[encodeCategory(category), ...parts].join("/")}`;
  }

  if (page.name === "admin") {
    return <AdminPage onBack={goHome} />;
  }

  if (page.name === "asset-sticker") {
    return <AssetStickerPage id={page.id} category={page.category} />;
  }

  if (page.name === "open-ticket") {
    return <OpenTicketPage id={page.id} category={page.category} />;
  }

  if (page.name === "inventory-new") {
    return (
      <InventoryDetailPage
        isNew
        category={page.category}
        listTitle={CATEGORY_TITLES[page.category] || "Inventory"}
        startInEditMode
        onBack={() => {
          window.location.hash = inventoryPath(page.category);
        }}
        onCreated={(id) => {
          window.location.hash = inventoryPath(page.category, id);
        }}
      />
    );
  }

  if (page.name === "inventory-detail") {
    return (
      <InventoryDetailPage
        id={page.id}
        category={page.category}
        listTitle={CATEGORY_TITLES[page.category] || "Inventory"}
        startInEditMode={page.startInEditMode}
        onBack={() => {
          window.location.hash = inventoryPath(page.category);
        }}
      />
    );
  }

  if (page.name === "inventory-list") {
    return (
      <ItInventoryPage
        category={page.category}
        title={CATEGORY_TITLES[page.category] || "Inventory"}
        onBack={goHome}
        onEdit={(id) => {
          window.location.hash = inventoryPath(page.category, id);
        }}
        onAdd={() => {
          window.location.hash = inventoryPath(page.category, "new");
        }}
      />
    );
  }

  return <HomePage />;
}
