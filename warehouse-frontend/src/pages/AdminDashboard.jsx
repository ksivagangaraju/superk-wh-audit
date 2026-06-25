import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import * as XLSX from "xlsx";

const BACKEND_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.startsWith("192.168")
    ? "http://localhost:5001"
    : "https://superk-wh-audit.onrender.com";
const socket = io(BACKEND_URL);

const AdminDashboard = () => {
  const [sessionId, setSessionId] = useState(
    localStorage.getItem("adminSessionId") || "",
  );
  const [inputSessionId, setInputSessionId] = useState("");

  const [zones, setZones] = useState([]);
  const [selectedZoneAdmin, setSelectedZoneAdmin] = useState("");

  const [completedZones, setCompletedZones] = useState([]);
  const [unlockedZones, setUnlockedZones] = useState([]);
  const [completedLocations, setCompletedLocations] = useState([]);
  const [unlockedLocations, setUnlockedLocations] = useState([]);

  const [masterData, setMasterData] = useState([]);
  const [isAuditRunning, setIsAuditRunning] = useState(false);

  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: "",
    type: "info",
  });
  const showAlert = (message, type = "info") =>
    setAlertModal({ isOpen: true, message, type });

  const fetchSessionStatus = () => {
    if (!sessionId) return;
    fetch(`${BACKEND_URL}/api/status/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setZones(data.zones || []);
          setCompletedZones(data.completedZones || []);
          setUnlockedZones(data.unlockedZones || []);
          setCompletedLocations(data.completedLocations || []);
          setUnlockedLocations(data.unlockedLocations || []);
          setMasterData(data.masterData || []);
          setIsAuditRunning(data.isAuditRunning || false);
        }
      })
      .catch((err) => console.error("Error fetching status:", err));
  };

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("adminSessionId", sessionId);
      socket.emit("join-session", sessionId);
      fetchSessionStatus();
    }
  }, [sessionId]);

  useEffect(() => {
    socket.on("initial-status", (data) => {
      setZones(data.zones || []);
      setCompletedZones(data.completedZones || []);
      setUnlockedZones(data.unlockedZones || []);
      setCompletedLocations(data.completedLocations || []);
      setUnlockedLocations(data.unlockedLocations || []);
      setIsAuditRunning(data.isAuditRunning || false);
      setMasterData(data.masterData || []);
    });

    socket.on("zone-status-changed", (data) => {
      setCompletedZones(data.completedZones || []);
      setUnlockedZones(data.unlockedZones || []);
    });

    socket.on("location-status-changed", (data) => {
      setCompletedLocations(data.completedLocations || []);
      setUnlockedLocations(data.unlockedLocations || []);
    });

    socket.on("audit-state-changed", (status) => setIsAuditRunning(status));

    socket.on("item-updated", (updatedItem) => {
      setMasterData((prevData) =>
        prevData.map((item) =>
          item.uid === updatedItem.uid ? updatedItem : item,
        ),
      );
    });

    socket.on("session-cleared", () => {
      setZones([]);
      setCompletedZones([]);
      setUnlockedZones([]);
      setCompletedLocations([]);
      setUnlockedLocations([]);
      setMasterData([]);
      setIsAuditRunning(false);
      setSelectedZoneAdmin("");
      showAlert("Data has been cleared.", "info");
    });

    return () => {
      socket.off("initial-status");
      socket.off("zone-status-changed");
      socket.off("location-status-changed");
      socket.off("audit-state-changed");
      socket.off("item-updated");
      socket.off("session-cleared");
    };
  }, []);

  const handleJoinOrCreate = () => {
    if (inputSessionId.trim().length >= 6) {
      const newId = inputSessionId.trim();
      fetch(`${BACKEND_URL}/api/create-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: newId }),
      })
        .then(() => {
          setSessionId(newId);
        })
        .catch((err) => showAlert("Could not connect to server", "error"));
    } else {
      showAlert("Team ID must be at least 6 characters long.", "error");
    }
  };

  const handleAdminUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws, { raw: false });

        if (jsonData.length === 0)
          return showAlert("The uploaded file is empty!", "error");

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
            const f = Object.keys(item).find(
              (key) => key.trim().toLowerCase() === k.toLowerCase(),
            );
            return f ? item[f] : "";
          };
          let rawQty = getVal("Available Quantity") || getVal("Qty") || 0;
          let sysQty = parseInt(String(rawQty).replace(/,/g, ""), 10);
          return {
            uid: index,
            ProductName: getVal("SKU Code") || getVal("Product Name") || "N/A",
            Zone: getVal("Zone") || "Unknown",
            Location: getVal("Location") || "N/A",
            SystemQty: isNaN(sysQty) ? 0 : sysQty,
            ActualQty: isNaN(sysQty) ? 0 : sysQty,
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

        fetch(`${BACKEND_URL}/api/set-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: formatted,
            zones: uniqueZones,
            sessionId,
          }),
        })
          .then((res) => res.json())
          .then(() => {
            setMasterData(formatted);
            setZones(uniqueZones);
            showAlert("File uploaded and synced successfully!", "success");
          })
          .catch((err) => showAlert("Backend error: " + err.message, "error"));
      } catch (err) {
        showAlert("Parsing failed: " + err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleExportData = () => {
    const auditedData = masterData.filter(
      (item) => String(item.AuditStatus).toLowerCase() !== "pending",
    );
    if (auditedData.length === 0) {
      return showAlert(
        "No items have been audited yet! Users need to verify items first.",
        "error",
      );
    }
    try {
      const ws = XLSX.utils.json_to_sheet(auditedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Audited_Data");
      XLSX.writeFile(wb, `Warehouse_Audit_${sessionId}.xlsx`);
      showAlert("Excel Exported Successfully!", "success");
    } catch (err) {
      showAlert("Failed to export: " + err.message, "error");
    }
  };

  const confirmLogoutRequest = () => {
    setAlertModal({
      isOpen: true,
      message:
        "Are you sure you want to Log Out? This will permanently delete all session data and kick all users out.",
      type: "confirm_logout",
    });
  };

  const executeLogoutAndClear = () => {
    fetch(`${BACKEND_URL}/api/clear-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (sessionId) {
      socket.emit("leave-session", sessionId);
    }
    setSessionId("");
    localStorage.removeItem("adminSessionId");
    setAlertModal({ isOpen: false, message: "", type: "info" });
  };

  const getLocationsForAdminZone = () => {
    const itemsInZone = masterData.filter(
      (p) => String(p.Zone) === String(selectedZoneAdmin),
    );
    return [...new Set(itemsInZone.map((p) => p.Location))].sort();
  };

  const handleUnlockLocation = (locationKey) =>
    socket.emit("unlock-location", { sessionId, locationKey });
  const handleUnlockZone = (zoneName) =>
    socket.emit("unlock-zone", { sessionId, zoneName });

  if (!sessionId) {
    return (
      <div
        className="screen-container bg-light"
        style={{ justifyContent: "center", alignItems: "center" }}
      >
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
                style={{ margin: "15px 0", color: "#475569", fontSize: "15px" }}
              >
                {alertModal.message}
              </p>
              <button
                className="btn-primary full-width mt-2"
                onClick={() =>
                  setAlertModal({ isOpen: false, message: "", type: "info" })
                }
              >
                OK
              </button>
            </div>
          </div>
        )}
        <div className="card-box text-center" style={{ margin: "0" }}>
          <h2>👑 Admin Login</h2>
          <p className="text-muted mt-2">
            Enter your Team ID (min 6 chars) to enter workspace.
          </p>
          <div
            style={{
              padding: "20px",
              background: "#f1f5f9",
              borderRadius: "10px",
              marginTop: "20px",
            }}
          >
            <input
              type="text"
              placeholder="Enter Team ID"
              value={inputSessionId}
              onChange={(e) => setInputSessionId(e.target.value)}
              className="modal-input"
              style={{ marginBottom: "10px" }}
            />
            <button
              className="btn-primary full-width"
              onClick={handleJoinOrCreate}
            >
              Login to Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getButtonStyle = (isDone, isUnlocked) => {
    if (isDone)
      return {
        background: "#10b981",
        color: "white",
        borderColor: "#059669",
        cursor: "not-allowed",
      };
    if (isUnlocked)
      return {
        background: "#dcfce7",
        color: "#166534",
        borderColor: "#22c55e",
        cursor: "pointer",
      };
    return {
      background: "#fff",
      color: "#0f172a",
      borderColor: "#cbd5e1",
      cursor: "pointer",
    };
  };

  return (
    <div className="screen-container bg-light" style={{ overflowY: "auto" }}>
      {alertModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-card text-center">
            <h3
              style={{
                color: alertModal.type === "error" ? "#ef4444" : "#3b82f6",
              }}
            >
              {alertModal.type === "error" ? "⚠️ Error" : "ℹ️ Notice"}
            </h3>
            <p style={{ margin: "15px 0", color: "#475569", fontSize: "15px" }}>
              {alertModal.message}
            </p>
            {alertModal.type === "confirm_logout" ? (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexDirection: "column",
                }}
              >
                <button
                  className="btn-danger full-width"
                  onClick={executeLogoutAndClear}
                >
                  Yes, Log Out & Clear Data
                </button>
                <button
                  className="btn-secondary full-width"
                  onClick={() =>
                    setAlertModal({ isOpen: false, message: "", type: "info" })
                  }
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="btn-primary full-width mt-2"
                onClick={() =>
                  setAlertModal({ isOpen: false, message: "", type: "info" })
                }
              >
                OK
              </button>
            )}
          </div>
        </div>
      )}

      <div className="top-nav" style={{ flexWrap: "wrap", gap: "10px" }}>
        <span className="font-bold">
          Team ID: <b style={{ color: "#3b82f6" }}>{sessionId}</b>
        </span>
        <div style={{ display: "flex", gap: "10px" }}>
          {masterData.length > 0 && (
            <button className="btn-success sm" onClick={handleExportData}>
              📥 Export Excel
            </button>
          )}
          <button className="btn-text danger sm" onClick={confirmLogoutRequest}>
            Log Out
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
        {masterData.length === 0 ? (
          <div className="card-box text-center">
            <h3>No Data Found in this Session</h3>
            <p className="text-muted" style={{ marginBottom: "20px" }}>
              Upload your master sheet to begin the audit.
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
              className="btn-success full-width"
              style={{
                display: "inline-block",
                padding: "15px",
                cursor: "pointer",
              }}
            >
              📤 Upload Excel File
            </label>
          </div>
        ) : (
          <>
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
              <h2
                style={{
                  color: isAuditRunning ? "#059669" : "#b91c1c",
                  margin: 0,
                }}
              >
                {isAuditRunning ? "🟢 Audit is LIVE" : "🛑 Audit is ON HOLD"}
              </h2>
              <p
                className="text-muted"
                style={{ marginTop: "10px", fontSize: "14px", marginBottom: 0 }}
              >
                {isAuditRunning
                  ? "Users can currently access and audit."
                  : "User screens are currently frozen."}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "center",
                  marginTop: "15px",
                }}
              >
                <button
                  className="btn-success"
                  onClick={() =>
                    socket.emit("toggle-audit-state", {
                      sessionId,
                      status: true,
                    })
                  }
                  disabled={isAuditRunning}
                >
                  ▶ Start
                </button>
                <button
                  className="btn-danger"
                  onClick={() =>
                    socket.emit("toggle-audit-state", {
                      sessionId,
                      status: false,
                    })
                  }
                  disabled={!isAuditRunning}
                >
                  ⏸ Hold
                </button>
              </div>
            </div>

            <div className="card-box">
              {!selectedZoneAdmin ? (
                <>
                  <h3 style={{ marginBottom: "20px" }}>Monitor Zones</h3>
                  <div
                    className="zone-grid"
                    style={{ maxWidth: "100%", padding: 0 }}
                  >
                    {zones.map((zone) => {
                      const isDone = completedZones.includes(zone);
                      const isUnlocked = unlockedZones.includes(zone);
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
                            className="btn-zone"
                            onClick={() => setSelectedZoneAdmin(zone)}
                            style={{
                              ...getButtonStyle(isDone, isUnlocked),
                            }}
                          >
                            {zone} <br />{" "}
                            <span
                              style={{ fontSize: "13px", fontWeight: "normal" }}
                            >
                              {isDone
                                ? "✅ Locked"
                                : isUnlocked
                                  ? "🔄 Correction"
                                  : "⏳ Active"}
                            </span>
                          </button>
                          {isDone && (
                            <button
                              className="btn-text sm danger"
                              onClick={() => handleUnlockZone(zone)}
                            >
                              🔓 Unlock Zone
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "20px",
                    }}
                  >
                    <button
                      className="btn-text"
                      onClick={() => setSelectedZoneAdmin("")}
                    >
                      ⬅ Back to Zones
                    </button>
                    <h3 style={{ margin: 0 }}>Zone: {selectedZoneAdmin}</h3>
                  </div>
                  <div
                    className="zone-grid"
                    style={{ maxWidth: "100%", padding: 0 }}
                  >
                    {getLocationsForAdminZone().map((loc) => {
                      const locKey = `${selectedZoneAdmin}___${loc}`;
                      const isDone = completedLocations.includes(locKey);
                      const isUnlocked = unlockedLocations.includes(locKey);
                      return (
                        <div
                          key={locKey}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "5px",
                          }}
                        >
                          <button
                            className="btn-zone"
                            disabled={true}
                            style={{
                              ...getButtonStyle(isDone, isUnlocked),
                              fontSize: "14px",
                              padding: "10px",
                            }}
                          >
                            <b style={{ fontSize: "18px" }}>{loc}</b> <br />{" "}
                            <span
                              style={{ fontSize: "13px", fontWeight: "normal" }}
                            >
                              {isDone
                                ? "✅ Locked"
                                : isUnlocked
                                  ? "🔄 Correction"
                                  : "⏳ Active"}
                            </span>
                          </button>
                          {isDone && (
                            <button
                              className="btn-text sm danger"
                              onClick={() => handleUnlockLocation(locKey)}
                            >
                              🔓 Unlock
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
