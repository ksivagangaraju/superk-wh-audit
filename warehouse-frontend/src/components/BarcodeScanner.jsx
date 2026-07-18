import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const BarcodeScanner = ({ onScan, onClose }) => {
  const scannerRef = useRef(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const isProcessing = useRef(false); // 🚀 Fast multi-scans ni block cheyadaniki

  useEffect(() => {
    // 100ms aagi DOM load ayyaka div ready chesthundi
    const timer = setTimeout(() => setIsCameraReady(true), 100);
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
          // 🚀 FIX: Fast ga double scan ayithe reject chesthundi
          if (isProcessing.current) return;
          isProcessing.current = true;

          // 🚀 FIX: Ikkada manual ga camera stop/clear cheyatledu.
          // Direct ga onScan pampi onClose() chesthunnam.
          // Deenivalla React smooth ga component ni unmount chesthundi.
          onScan(decodedText);
          onClose();
        },
        (errorMessage) => {
          // Background error console ignore
        },
      )
      .catch((err) => console.warn("Camera start error:", err));

    // 🚀 CLEANUP FIX (Idi app crash ni aputhundi)
    return () => {
      // Component close ainappudu ONLY hardware lens off chestham. (.clear() asalu vadaddu)
      // .clear() vadithe React DOM tho clash ayyi App Blank/Crash avuthundi.
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch (error) {
          // ignore
        }
      }
    };
  }, [isCameraReady, onScan, onClose]);

  const handleClose = () => {
    // Cancel click chesinappudu kuda safe close
    if (isProcessing.current) return;
    isProcessing.current = true;
    onClose();
  };

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

        <button
          className="btn-danger full-width"
          onClick={handleClose}
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
