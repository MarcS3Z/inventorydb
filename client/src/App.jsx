import { useEffect, useState } from "react";
import AdminPage from "./AdminPage.jsx";
import AssetStickerPage from "./AssetStickerPage.jsx";
import InventoryDetailPage from "./InventoryDetailPage.jsx";
import ItInventoryPage from "./ItInventoryPage.jsx";

const inventoryLinks = [
  { label: "IT Inventory", category: "IT" },
  { label: "PTI Facilities Inventory", category: "PTI" },
  { label: "Horizons Facilities Inventory", category: "FND" },
];

const CATEGORY_TITLES = {
  IT: "IT Inventory",
  PTI: "PTI Facilities Inventory",
  FND: "Horizons Facilities Inventory",
};

function getPageFromHash() {
  const hash = window.location.hash;

  if (hash === "#/admin") return { name: "admin" };

  const stickerMatch = hash.match(/^#\/inventory\/(IT|PTI|FND)\/(\d+)\/sticker$/);
  if (stickerMatch) {
    return {
      name: "asset-sticker",
      category: stickerMatch[1],
      id: Number(stickerMatch[2]),
    };
  }

  const detailMatch = hash.match(/^#\/inventory\/(IT|PTI|FND)\/(\d+)(\/edit)?$/);
  if (detailMatch) {
    return {
      name: "inventory-detail",
      category: detailMatch[1],
      id: Number(detailMatch[2]),
      startInEditMode: Boolean(detailMatch[3]),
    };
  }

  const listMatch = hash.match(/^#\/inventory\/(IT|PTI|FND)$/);
  if (listMatch) {
    return { name: "inventory-list", category: listMatch[1] };
  }

  // Legacy hashes
  if (hash === "#/it-inventory") {
    return { name: "inventory-list", category: "IT" };
  }
  const legacyDetail = hash.match(/^#\/it-inventory\/(\d+)$/);
  if (legacyDetail) {
    return {
      name: "inventory-detail",
      category: "IT",
      id: Number(legacyDetail[1]),
    };
  }

  return { name: "home" };
}

function HomePage() {
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
              window.location.hash = `#/inventory/${category}`;
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
      </nav>
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

  if (page.name === "admin") {
    return <AdminPage onBack={goHome} />;
  }

  if (page.name === "asset-sticker") {
    return <AssetStickerPage id={page.id} category={page.category} />;
  }

  if (page.name === "inventory-detail") {
    return (
      <InventoryDetailPage
        id={page.id}
        category={page.category}
        listTitle={CATEGORY_TITLES[page.category] || "Inventory"}
        startInEditMode={page.startInEditMode}
        onBack={() => {
          window.location.hash = `#/inventory/${page.category}`;
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
          window.location.hash = `#/inventory/${page.category}/${id}`;
        }}
        onAdd={(id) => {
          window.location.hash = `#/inventory/${page.category}/${id}/edit`;
        }}
      />
    );
  }

  return <HomePage />;
}
