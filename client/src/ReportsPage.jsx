export default function ReportsPage({ onBack }) {
  return (
    <div className="app">
      <header className="header">
        <button type="button" className="secondary back-button" onClick={onBack}>
          ← Home
        </button>
        <h1>Reports</h1>
      </header>
    </div>
  );
}
