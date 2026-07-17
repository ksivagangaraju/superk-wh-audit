import React from "react";
import { QrReader } from "react-qr-reader";

const BarcodeScanner = ({ onScan, onClose }) => {
  return (
    <div className="modal-overlay" style={{ zIndex: 11000 }}>
      <div
        className="modal-card"
        style={{ padding: "10px", background: "black" }}
      >
        <h3
          style={{ color: "white", textAlign: "center", marginBottom: "10px" }}
        >
          📷 Scan Barcode
        </h3>
        <div
          style={{
            borderRadius: "15px",
            overflow: "hidden",
            border: "2px solid #3b82f6",
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
            containerStyle={{ width: "100%", height: "300px" }}
          />
        </div>
        <button className="btn-danger full-width mt-2" onClick={onClose}>
          ❌ Cancel Scan
        </button>
      </div>
    </div>
  );
};

export default BarcodeScanner;
