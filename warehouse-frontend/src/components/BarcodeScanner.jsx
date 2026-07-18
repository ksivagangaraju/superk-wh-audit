import React from "react";
import { QrReader } from "react-qr-reader";

const BarcodeScanner = ({ onScan, onClose }) => {
  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 11000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        className="modal-card"
        style={{
          padding: "20px",
          background: "#0f172a",
          width: "95%",
          maxWidth: "400px",
        }}
      >
        <h3
          style={{ color: "white", textAlign: "center", marginBottom: "15px" }}
        >
          📷 Scan Barcode
        </h3>

        {/* Ikkada fixed height theesesanu, video objectFit cover add chesanu */}
        <div
          style={{
            width: "100%",
            borderRadius: "12px",
            overflow: "hidden",
            border: "3px solid #3b82f6",
            backgroundColor: "#000",
          }}
        >
          <QrReader
            onResult={(result, error) => {
              if (result) {
                onScan(result?.text);
                onClose();
              }
            }}
            constraints={{ facingMode: "environment" }}
            videoStyle={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

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
