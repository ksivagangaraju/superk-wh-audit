import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const BarcodeScanner = ({ onScan, onClose }) => {
  const scannerRef = useRef(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const isScanned = useRef(false); // 🚀 Okkasari scan ayyaka block cheyadaniki flag

  useEffect(() => {
    // Component open ayina 100ms tarvatha div ni ready chesthundi
    const timer = setTimeout(() => {
      setIsCameraReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isCameraReady) return;

    const html5QrCode = new Html5Qrcode("custom-scanner-box");
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // 🚀 THE FIX: Double scan triggers ni block chesthundi
          if (isScanned.current) return;
          isScanned.current = true;

          // 🚀 THE FIX: Ikkada manual ga stop/clear kottakunda direct data pampinchi onClose chesthunnam.
          // Deeni valla React DOM crash avvadu. React automatic ga component close chesthundi.
          onScan(decodedText);
          onClose();
        },
        (errorMessage) => {
          // Ignore scanning errors
        },
      )
      .catch((err) => console.error("Camera error:", err));

    // 🚀 React Component close (unmount) ayyaka SAFE ga camera aagipothundi
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current.clear();
          })
          .catch(() => {
            // Error vacchina lite theesko
          });
      }
    };
  }, [isCameraReady, onScan, onClose]);

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 11000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.8)",
      }}
    >
      <div
        className="modal-card"
        style={{
          padding: "20px",
          background: "#0f172a",
          width: "95%",
          maxWidth: "400px",
          borderRadius: "15px",
        }}
      >
        <h3
          style={{ color: "white", textAlign: "center", marginBottom: "15px" }}
        >
          📷 Scan Barcode
        </h3>

        <div
          style={{
            width: "100%",
            borderRadius: "12px",
            overflow: "hidden",
            border: "3px solid #3b82f6",
            backgroundColor: "#000",
            minHeight: "300px",
            position: "relative",
          }}
        >
          {isCameraReady ? (
            <div
              id="custom-scanner-box"
              style={{ width: "100%", minHeight: "300px" }}
            ></div>
          ) : (
            <p
              style={{ color: "white", textAlign: "center", padding: "50px 0" }}
            >
              Starting Camera...
            </p>
          )}
        </div>

        {/* 🚀 Button Click lo kuda direct React onClose() peduthunnam. Crash radu. */}
        <button
          className="btn-danger full-width"
          onClick={onClose}
          style={{
            marginTop: "20px",
            padding: "12px",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          ❌ Cancel Scan
        </button>
      </div>
    </div>
  );
};

export default BarcodeScanner;
