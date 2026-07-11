import React from "react";
import { QrReader } from "react-qr-reader";

const BarcodeScanner = ({ onScan, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <QrReader
          onResult={(result, error) => {
            if (result) {
              onScan(result.text);
              onClose();
            }
          }}
          constraints={{ facingMode: "environment" }} // Back camera open avuthundi
          containerStyle={{ width: "100%" }}
        />
        <button className="btn-secondary full-width mt-2" onClick={onClose}>
          Close Scanner
        </button>
      </div>
    </div>
  );
};
export default BarcodeScanner;
