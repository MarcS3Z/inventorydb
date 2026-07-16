const inventoryLinks = [
  "IT Inventory",
  "PTI Facilities Inventory",
  "Horizons Facilities Inventory",
];

export default function App() {
  return (
    <div className="app home">
      <header className="header">
        <h1>InventoryDB</h1>
      </header>

      <nav className="home-nav" aria-label="Inventory sections">
        {inventoryLinks.map((label) => (
          <button key={label} type="button">
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
