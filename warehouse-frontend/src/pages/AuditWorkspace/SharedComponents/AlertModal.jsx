import React from "react";

const AlertModal = ({ isOpen, type, message, onClose, onConfirm }) => {
  if (!isOpen) return null;

  const isError = type === "error";
  const isConfirm = type === "confirm";

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-card text-center">
        <h3 style={{ color: isError ? "#ef4444" : "#3b82f6" }}>
          {isError ? "⚠️ Notice" : "ℹ️ Info"}
        </h3>
        <p style={{ margin: "15px 0", color: "#475569" }}>{message}</p>

        {isConfirm ? (
          <div
            style={{ display: "flex", gap: "10px", flexDirection: "column" }}
          >
            <button className="btn-danger full-width" onClick={onConfirm}>
              Yes, Confirm
            </button>
            <button className="btn-secondary full-width" onClick={onClose}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn-primary full-width mt-2" onClick={onClose}>
            OK
          </button>
        )}
      </div>
    </div>
  );
};

export default AlertModal;
