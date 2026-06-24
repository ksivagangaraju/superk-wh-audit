import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import * as XLSX from "xlsx";

const socket = io("https://superk-wh-audit.onrender.com");

const AdminDashboard = () => {
  const [zones, setZones] = useState([]);
  const [completedZones, setCompletedZones] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isAuditRunning, setIsAuditRunning] = useState(false);

  // Custom Alert Modal State
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: "",
    type: "info",
  });

  const showAlert = (message, type = "info") => {
    setAlertModal({ isOpen: true, message, type });
  };

  useEffect(() => {
    fetch("https://superk-wh-audit.onrender.com/api/status")
      .then((res) => res.json())
      .then((data) => {
        setZones(data.zones || []);
        setCompletedZones(data.completedZones || []);
        setTotalItems(data.totalItems || 0);
        setIsAuditRunning(data.isAuditRunning || false);
      })
      .catch((err) => console.error("Error fetching status:", err));

    socket.on("initial-status", (data) => {
      setZones(data.zones || []);
      setCompletedZones(data.completedZones || []);
      setIsAuditRunning(data.isAuditRunning || false);
    });

    socket.on("zone-status-changed", (data) =>
      setCompletedZones(data.completedZones || []),
    );
    socket.on("audit-state-changed", (status) => setIsAuditRunning(status));

    socket.on("data-updated", (data) => {
      setZones(data.zones || []);
      setCompletedZones(data.completedZones || []);
      setIsAuditRunning(data.isAuditRunning || false);
      setTotalItems(data.masterData ? data.masterData.length : 0);
    });

    return () => {
      socket.off("initial-status");
      socket.off("zone-status-changed");
      socket.off("audit-state-changed");
      socket.off("data-updated");
    };
  }, []);

  const handleAdminUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames];
        const jsonData = XLSX.utils.sheet_to_json(ws, { raw: false });

        if (jsonData.length === 0) {
          document.getElementById("admin-file").value = "";
          return showAlert("The uploaded file is empty!", "error");
        }

        const uniqueZones = [
          ...new Set(
            jsonData.map((item) => {
              const foundKey = Object.keys(item).find(
                (k) => k.trim().toLowerCase() === "zone",
              );
              return foundKey ? item[foundKey] : null;
            }),
          ),
        ]
          .filter(Boolean)
          .sort();

        const formatted = jsonData.map((item, index) => {
          const getVal = (k) => {
            const found = Object.keys(item).find(
              (key) => key.trim().toLowerCase() === k.toLowerCase(),
            );
            return found ? item[found] : "";
          };
          let rawQty = getVal("Available Quantity") || getVal("Qty") || 0;
          let qtyNum = parseInt(String(rawQty).replace(/,/g, ""), 10);
          return {
            uid: index,
            ProductName: getVal("SKU Code") || getVal("Product Name") || "N/A",
            Zone: getVal("Zone") || "Unknown",
            Location: getVal("Location") || "N/A",
            SystemQty: isNaN(qtyNum) ? 0 : qtyNum,
            ActualQty: isNaN(qtyNum) ? 0 : qtyNum,
            SystemMRP: getVal("MRP") || "",
            ActualMRP: getVal("MRP") || "",
            SystemExpDate: getVal("Exp Date") || "",
            ActualExpDate: getVal("Exp Date") || "",
            Barcode1: getVal("Barcode") || "N/A",
            Barcode2: getVal("Alias") || "N/A",
            ActualBarcode: "",
            AuditStatus: "Pending",
          };
        });

        fetch("https://superk-wh-audit.onrender.com/api/set-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: formatted, zones: uniqueZones }),
        })
          .then(() => {
            showAlert(
              "Master File successfully synced! The audit is currently ON HOLD. Start it when ready.",
              "success",
            );
            document.getElementById("admin-file").value = "";
          })
          .catch((err) =>
            showAlert("Backend offline error: " + err.message, "error"),
          );
      } catch (err) {
        showAlert("Parsing failed: " + err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleAuditState = (status) =>
    socket.emit("toggle-audit-state", status);
  const handleUnlockZone = (zoneName) => socket.emit("unlock-zone", zoneName);

  const exportAuditedData = async () => {
    try {
      const res = await fetch(
        "https://superk-wh-audit.onrender.com/api/status",
      );
      const data = await res.json();

      const auditedItems = data.masterData.filter(
        (item) =>
          item.AuditStatus === "Verified" || item.AuditStatus === "Discrepancy",
      );

      if (auditedItems.length === 0) {
        return showAlert(
          "No audited data found! Users haven't verified or flagged any items yet.",
          "error",
        );
      }

      const cleanDataForExcel = auditedItems.map((item) => ({
        "Product Name": item.ProductName,
        Zone: item.Zone,
        Location: item.Location,
        "System Qty": item.SystemQty,
        "Actual Qty": item.ActualQty,
        "System MRP": item.SystemMRP,
        "Actual MRP": item.ActualMRP,
        "System Exp Date": item.SystemExpDate,
        "Actual Exp Date": item.ActualExpDate,
        "System Barcode 1": item.Barcode1,
        "System Barcode 2": item.Barcode2,
        "Scanned Actual Barcode": item.ActualBarcode,
        "Audit Status": item.AuditStatus,
      }));

      const ws = XLSX.utils.json_to_sheet(cleanDataForExcel);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Audited_Stock");
      XLSX.writeFile(wb, "Warehouse_Clean_Audit.xlsx");
    } catch (err) {
      showAlert("Error exporting data: " + err.message, "error");
    }
  };

  return (
    <div className="screen-container bg-light" style={{ overflowY: "auto" }}>
      {/* GLOBAL CUSTOM ALERT MODAL */}
      {alertModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-card text-center">
            <h3
              style={{
                color: alertModal.type === "error" ? "#ef4444" : "#3b82f6",
              }}
            >
              {alertModal.type === "error" ? "⚠️ Error" : "ℹ️ Notification"}
            </h3>
            <p
              style={{
                margin: "15px 0",
                color: "#475569",
                fontSize: "15px",
                lineHeight: "1.4",
              }}
            >
              {alertModal.message}
            </p>
            <button
              className="btn-primary full-width"
              onClick={() =>
                setAlertModal({ isOpen: false, message: "", type: "info" })
              }
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="top-nav" style={{ flexWrap: "wrap", gap: "10px" }}>
        <span className="font-bold">👑 Admin Master Console</span>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn-success" onClick={exportAuditedData}>
            📥 Export Audited Data
          </button>
        </div>
      </div>

      <div
        style={{
          padding: "20px",
          maxWidth: "800px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          className="card-box text-center"
          style={{
            marginBottom: "20px",
            background: isAuditRunning ? "#ecfdf5" : "#fef2f2",
            borderColor: isAuditRunning ? "#10b981" : "#ef4444",
            borderWidth: "2px",
            borderStyle: "solid",
          }}
        >
          <h2 style={{ color: isAuditRunning ? "#059669" : "#b91c1c" }}>
            {isAuditRunning ? "🟢 Audit is LIVE" : "🛑 Audit is ON HOLD"}
          </h2>
          <p className="text-muted" style={{ marginBottom: "15px" }}>
            {isAuditRunning
              ? "Users can currently access zones and audit items."
              : "All user screens are currently locked and frozen."}
          </p>
          <div
            style={{ display: "flex", gap: "10px", justifyContent: "center" }}
          >
            <button
              className="btn-success"
              onClick={() => toggleAuditState(true)}
              disabled={isAuditRunning}
            >
              ▶ Start Audit
            </button>
            <button
              className="btn-danger"
              onClick={() => toggleAuditState(false)}
              disabled={!isAuditRunning}
            >
              ⏸ Hold Audit
            </button>
          </div>
        </div>

        <div className="card-box text-center" style={{ marginBottom: "30px" }}>
          <h3 style={{ marginBottom: "10px" }}>📥 Upload Master Stock File</h3>
          <p
            className="text-muted"
            style={{ marginBottom: "25px", fontSize: "14px" }}
          >
            Upload original xlsx/csv schema to broadcast to all warehouse user
            devices
          </p>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleAdminUpload}
            id="admin-file"
            style={{ display: "none" }}
          />
          <label
            htmlFor="admin-file"
            className="btn-primary"
            style={{ display: "inline-block" }}
          >
            Upload New Sheet
          </label>
        </div>

        <div className="card-box">
          <h3 className="text-center" style={{ marginBottom: "20px" }}>
            Live Warehouse Zone Telemetry
          </h3>
          <div className="zone-grid" style={{ maxWidth: "100%" }}>
            {zones.map((zone) => {
              const isDone = completedZones.includes(zone);
              return (
                <div
                  key={zone}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                  }}
                >
                  <button
                    className={`btn-zone ${isDone ? "completed" : ""}`}
                    disabled={true}
                    style={{ width: "100%" }}
                  >
                    {zone} {isDone ? "✅" : "⏳"}
                  </button>
                  {isDone && (
                    <button
                      className="btn-text sm danger"
                      onClick={() => handleUnlockZone(zone)}
                      style={{ fontWeight: "bold" }}
                    >
                      🔓 Unlock / Reopen
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {zones.length === 0 && (
            <p className="text-center text-muted" style={{ marginTop: "20px" }}>
              No stock data session found. Please upload a file.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
