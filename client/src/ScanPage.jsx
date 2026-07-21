import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const READER_ID = "inventory-qr-reader";

function clearScanner(scanner) {
  try {
    scanner.clear();
  } catch {
    // The reader may already be cleared during route cleanup.
  }
}

function inventoryHashFromQr(value) {
  const text = String(value || "").trim();
  const hashStart = text.indexOf("#/inventory/");
  const hash = hashStart >= 0 ? text.slice(hashStart) : text;
  const match = hash.match(/^#\/inventory\/(\d+)\/(\d+)\/?$/);
  return match ? `#/inventory/${match[1]}/${match[2]}` : null;
}

export default function ScanPage({ onBack }) {
  const scannerRef = useRef(null);
  const runningRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (!scanner) return;

      if (runningRef.current) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => clearScanner(scanner));
      } else {
        clearScanner(scanner);
      }
    };
  }, []);

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (!scanner || !runningRef.current) return;

    try {
      await scanner.stop();
    } finally {
      runningRef.current = false;
      setScanning(false);
      clearScanner(scanner);
      scannerRef.current = null;
    }
  }

  async function startScanner() {
    setError(null);

    try {
      const scanner = new Html5Qrcode(READER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          const inventoryHash = inventoryHashFromQr(decodedText);
          if (!inventoryHash) {
            setError("This QR code does not contain an InventoryDB record URL.");
            return;
          }

          await stopScanner();
          window.location.hash = `${inventoryHash}?from=scan`;
        },
        () => {
          // No QR code was found in this frame; keep scanning.
        }
      );
      runningRef.current = true;
      setScanning(true);
    } catch (err) {
      runningRef.current = false;
      scannerRef.current = null;
      setScanning(false);
      setError(
        err?.message ||
          "Unable to start the camera. Check browser camera permissions."
      );
    }
  }

  return (
    <div className="app scan-page">
      <header className="header">
        <button type="button" className="secondary back-button" onClick={onBack}>
          ← Home
        </button>
        <h1>Scan Asset</h1>
        <p>Scan an InventoryDB asset sticker to open its inventory record.</p>
      </header>

      {error && <div className="banner error">{error}</div>}

      <section className="panel scan-panel">
        <div id={READER_ID} className="qr-reader" />
        <div className="actions">
          {scanning ? (
            <button type="button" className="secondary" onClick={stopScanner}>
              Stop Camera
            </button>
          ) : (
            <button type="button" onClick={startScanner}>
              Start Camera
            </button>
          )}
        </div>
        <p className="muted">
          Camera access requires HTTPS and browser permission.
        </p>
      </section>
    </div>
  );
}
