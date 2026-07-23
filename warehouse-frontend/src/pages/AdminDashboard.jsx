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
  const [activeTab, setActiveTab] = useState("inventory");

  // INVENTORY
  const [zones, setZones] = useState([]);
  const [selectedZoneAdmin, setSelectedZoneAdmin] = useState("");
  const [completedZones, setCompletedZones] = useState([]);
  const [unlockedZones, setUnlockedZones] = useState([]);
  const [completedLocations, setCompletedLocations] = useState([]);
  const [unlockedLocations, setUnlockedLocations] = useState([]);
  const [masterData, setMasterData] = useState([]);
  const [isAuditRunning, setIsAuditRunning] = useState(false);

  // DISPATCH
  const [dispatchData, setDispatchData] = useState([]);
  const [isDispatchRunning, setIsDispatchRunning] = useState(false);
  const [dispatchDetailsModal, setDispatchDetailsModal] = useState({
    isOpen: false,
    title: "",
    data: [],
  });

  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: "",
    type: "info",
  });
  const [showInstructions, setShowInstructions] = useState(false);

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
          setDispatchData(data.dispatchData || []);
          setIsDispatchRunning(data.isDispatchRunning || false);
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
      setDispatchData(data.dispatchData || []);
      setIsDispatchRunning(data.isDispatchRunning || false);
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
    socket.on("dispatch-state-changed", (status) =>
      setIsDispatchRunning(status),
    );
    socket.on("item-updated", (updatedItem) =>
      setMasterData((prev) =>
        prev.map((item) => (item.uid === updatedItem.uid ? updatedItem : item)),
      ),
    );
    socket.on("dispatch-data-updated", (dData) => setDispatchData(dData));

    socket.on("session-cleared", () => {
      setZones([]);
      setCompletedZones([]);
      setUnlockedZones([]);
      setCompletedLocations([]);
      setUnlockedLocations([]);
      setMasterData([]);
      setDispatchData([]);
      setIsAuditRunning(false);
      setIsDispatchRunning(false);
      setSelectedZoneAdmin("");
      showAlert("Data has been cleared.", "info");
    });

    return () => {
      socket.off("initial-status");
      socket.off("zone-status-changed");
      socket.off("location-status-changed");
      socket.off("audit-state-changed");
      socket.off("dispatch-state-changed");
      socket.off("item-updated");
      socket.off("dispatch-data-updated");
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
        .then(() => setSessionId(newId))
        .catch(() => showAlert("Could not connect to server", "error"));
    } else showAlert("Team ID must be at least 6 characters long.", "error");
  };

  const handleInventoryUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result), {
          type: "array",
        });
        const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
          raw: false,
        });
        if (jsonData.length === 0) return showAlert("File is empty!", "error");

        const uniqueZones = [
          ...new Set(
            jsonData.map(
              (item) =>
                item[
                  Object.keys(item).find(
                    (k) => k.trim().toLowerCase() === "zone",
                  )
                ],
            ),
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
            AuditedBy: "",
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
            showAlert("Inventory Uploaded Successfully!", "success");
          });
      } catch (err) {
        showAlert("Parsing failed: " + err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleDispatchUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result), {
          type: "array",
        });
        const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
          raw: false,
        });
        if (jsonData.length === 0) return showAlert("File is empty!", "error");

        const formattedDispatch = jsonData.map((row) => {
          const getVal = (searchKey) => {
            const foundKey = Object.keys(row).find(
              (k) =>
                k.trim().toLowerCase().replace(/\s/g, "") ===
                searchKey.toLowerCase(),
            );
            return foundKey ? row[foundKey] : "";
          };
          const storeName =
            getVal("storename") || getVal("store") || "Unknown Store";
          let rawCartons = getVal("acceptedcartons") || getVal("cartons") || "";

          let palletNumber =
            getVal("palletnumber") ||
            getVal("palletno") ||
            getVal("pallet") ||
            "Unassigned";

          let cartonsArray = [];
          if (typeof rawCartons === "string" && rawCartons.trim() !== "") {
            const matches = rawCartons.match(/[a-zA-Z0-9\-_]+/g);
            if (matches) cartonsArray = matches;
          } else if (Array.isArray(rawCartons))
            cartonsArray = rawCartons.map(String);
          else if (rawCartons) cartonsArray = [String(rawCartons)];

          return {
            StoreName: storeName,
            ExpectedCartons: cartonsArray,
            PalletNumber: palletNumber,
            AcceptedCartons: [],
            RejectedCartons: [],
            ScannedBy: {},
          };
        });

        // 🚀 FIX: Frontend state ni direct ga overwrite cheyatledu.
        // Backend ki pampisthunnam. Backend merge chesi "dispatch-data-updated" event dwara pamputhundi.
        socket.emit("update-dispatch-excel", {
          sessionId,
          excelData: formattedDispatch,
        });

        showAlert(
          "Excel Processing... Merging with existing data safely!",
          "success",
        );
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
    if (auditedData.length === 0)
      return showAlert("No items have been audited yet!", "error");
    try {
      const exportFormat = auditedData.map((item) => ({
        "Product Name": item.ProductName,
        Zone: item.Zone,
        Location: item.Location,
        "System Qty": item.SystemQty,
        "Actual Qty": item.ActualQty,
        "Audit Status": item.AuditStatus,
        "Audited By": item.AuditedBy || "Unknown",
      }));
      const ws = XLSX.utils.json_to_sheet(exportFormat);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Audited_Data");
      XLSX.writeFile(wb, `Warehouse_Audit_${sessionId}.xlsx`);
      showAlert("Excel Exported Successfully!", "success");
    } catch (err) {
      showAlert("Failed to export: " + err.message, "error");
    }
  };

  const executeLogoutAndClear = () => {
    fetch(`${BACKEND_URL}/api/clear-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (sessionId) socket.emit("leave-session", sessionId);
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

  const openDispatchDetails = (store, type) => {
    let dataToShow = [];
    if (type === "Pending") {
      const pendingBoxes = store.ExpectedCartons.filter(
        (c) => !store.AcceptedCartons.includes(c),
      );
      dataToShow = pendingBoxes.map((b) => ({
        carton: b,
        details: "⏳ Not scanned yet",
      }));
    } else if (type === "Accepted") {
      dataToShow = store.AcceptedCartons.map((b) => ({
        carton: b,
        details:
          store.ScannedBy && store.ScannedBy[b]
            ? `👤 Scanned by: ${store.ScannedBy[b].user}`
            : "Verified",
      }));
    } else if (type === "Alerts") {
      dataToShow = store.RejectedCartons.map((b) => ({
        carton: b,
        details:
          store.ScannedBy && store.ScannedBy[b]
            ? `👤 ${store.ScannedBy[b].user} -> 🛑 ${store.ScannedBy[b].msg}`
            : "Alert",
      }));
    }
    setDispatchDetailsModal({
      isOpen: true,
      title: `${store.StoreName} (${type})`,
      data: dataToShow,
    });
  };

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

  if (!sessionId) {
    return (
      <div
        className="screen-container bg-light"
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <div className="card-box text-center" style={{ margin: "0" }}>
          <h2>👑 Admin Login</h2>
          <p className="text-muted mt-2">Enter your Team ID (min 6 chars)</p>
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

  return (
    <div className="screen-container bg-light" style={{ overflowY: "auto" }}>
      {/* Modals & Alerts */}
      {alertModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-card text-center">
            <h3
              style={{
                color: alertModal.type === "error" ? "#ef4444" : "#3b82f6",
              }}
            >
              {alertModal.type === "error" ? "⚠️ Notice" : "ℹ️ Info"}
            </h3>
            <p style={{ margin: "15px 0", color: "#475569" }}>
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

      {dispatchDetailsModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card" style={{ maxWidth: "450px" }}>
            <h3
              style={{
                borderBottom: "2px solid #e2e8f0",
                paddingBottom: "10px",
                marginBottom: "15px",
              }}
            >
              {dispatchDetailsModal.title}
            </h3>
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              {dispatchDetailsModal.data.length === 0 ? (
                <p className="text-muted">No items found.</p>
              ) : null}
              {dispatchDetailsModal.data.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "10px",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: "14px",
                  }}
                >
                  <b style={{ color: "#0f172a", fontSize: "15px" }}>
                    📦 {item.carton}
                  </b>{" "}
                  <br />
                  <span
                    style={{
                      color: "#64748b",
                      fontSize: "13px",
                      marginTop: "5px",
                      display: "block",
                    }}
                  >
                    {item.details}
                  </span>
                </div>
              ))}
            </div>
            <button
              className="btn-primary full-width mt-2"
              onClick={() =>
                setDispatchDetailsModal({ isOpen: false, title: "", data: [] })
              }
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-card">
            <h3 style={{ color: "#3b82f6", textAlign: "center" }}>
              📖 Admin Guide
            </h3>
            <div className="instructions-content">
              <p>
                Share your <b>Team ID</b> ({sessionId}) with the users. Use
                Start/Hold controls to manage access.
              </p>
            </div>
            <button
              className="btn-primary full-width"
              onClick={() => setShowInstructions(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      <div className="top-nav" style={{ flexWrap: "wrap", gap: "10px" }}>
        <span className="font-bold">
          Team ID: <b style={{ color: "#3b82f6" }}>{sessionId}</b>
        </span>
        <div style={{ display: "flex", gap: "10px" }}>
          {masterData.length > 0 && activeTab === "inventory" && (
            <button className="btn-success sm" onClick={handleExportData}>
              📥 Export Excel
            </button>
          )}
          <button
            className="btn-text danger sm"
            onClick={() =>
              setAlertModal({
                isOpen: true,
                message: "Log Out & Delete All Data?",
                type: "confirm_logout",
              })
            }
          >
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
        <div className="nav-tabs">
          <button
            className={activeTab === "inventory" ? "active" : ""}
            onClick={() => setActiveTab("inventory")}
          >
            📦 Inventory Audit
          </button>
          <button
            className={activeTab === "dispatch" ? "active" : ""}
            onClick={() => setActiveTab("dispatch")}
          >
            🚚 Dispatch Verification
          </button>
        </div>

        {/* 📦 INVENTORY TAB */}
        {activeTab === "inventory" &&
          (masterData.length === 0 ? (
            <div className="card-box text-center">
              <h3>No Inventory Data</h3>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleInventoryUpload}
                id="admin-file"
                style={{ display: "none" }}
              />
              <label
                htmlFor="admin-file"
                className="btn-success full-width mt-2"
                style={{
                  display: "inline-block",
                  padding: "15px",
                  cursor: "pointer",
                }}
              >
                📤 Upload Inventory Excel
              </label>
            </div>
          ) : (
            <>
              <div
                className="card-box text-center"
                style={{ padding: "15px", marginBottom: "20px" }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h2
                    style={{
                      color: isAuditRunning ? "#059669" : "#b91c1c",
                      margin: 0,
                      marginBottom: "10px",
                    }}
                  >
                    {isAuditRunning ? "🟢 Audit LIVE" : "🛑 Audit ON HOLD"}
                  </h2>
                  <div>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleInventoryUpload}
                      id="reupload-inv"
                      style={{ display: "none" }}
                    />
                    <label
                      htmlFor="reupload-inv"
                      className="btn-secondary sm"
                      style={{
                        cursor: "pointer",
                        padding: "8px 12px",
                        borderRadius: "6px",
                      }}
                    >
                      🔄 Upload New
                    </label>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    justifyContent: "center",
                    marginTop: "20px",
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
                  <button
                    className="btn-danger"
                    style={{ background: "#94a3b8" }}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Are you sure you want to clear ALL Inventory Data?",
                        )
                      ) {
                        socket.emit("clear-inventory-data", sessionId);
                      }
                    }}
                  >
                    🗑️ Clear
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
                              style={{ ...getButtonStyle(isDone, isUnlocked) }}
                            >
                              {zone} <br />{" "}
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: "normal",
                                }}
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
                              style={{ ...getButtonStyle(isDone, isUnlocked) }}
                            >
                              <b>{loc}</b> <br />{" "}
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: "normal",
                                }}
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
          ))}

        {/* 🚚 DISPATCH TAB */}
        {activeTab === "dispatch" &&
          (dispatchData.length === 0 ? (
            <div className="card-box text-center">
              <h3>No Dispatch Data</h3>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleDispatchUpload}
                id="dispatch-file"
                style={{ display: "none" }}
              />
              <label
                htmlFor="dispatch-file"
                className="btn-primary full-width mt-2"
                style={{
                  display: "inline-block",
                  padding: "15px",
                  cursor: "pointer",
                }}
              >
                📤 Upload Dispatch Excel
              </label>
            </div>
          ) : (
            <div>
              <div
                className="card-box text-center"
                style={{
                  padding: "15px",
                  marginBottom: "20px",
                  background: isDispatchRunning ? "#ecfdf5" : "#fef2f2",
                  borderColor: isDispatchRunning ? "#10b981" : "#ef4444",
                  borderWidth: "2px",
                  borderStyle: "solid",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h2
                    style={{
                      color: isDispatchRunning ? "#059669" : "#b91c1c",
                      margin: 0,
                      marginBottom: "10px",
                    }}
                  >
                    {isDispatchRunning
                      ? "🟢 Dispatch LIVE"
                      : "🛑 Dispatch ON HOLD"}
                  </h2>
                  <div>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleDispatchUpload}
                      id="reupload-disp"
                      style={{ display: "none" }}
                    />
                    <label
                      htmlFor="reupload-disp"
                      className="btn-secondary sm"
                      style={{
                        cursor: "pointer",
                        padding: "8px 12px",
                        borderRadius: "6px",
                      }}
                    >
                      🔄 Upload New
                    </label>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    justifyContent: "center",
                    marginTop: "20px",
                  }}
                >
                  <button
                    className="btn-success"
                    onClick={() =>
                      socket.emit("toggle-dispatch-state", {
                        sessionId,
                        status: true,
                      })
                    }
                    disabled={isDispatchRunning}
                  >
                    ▶ Start Scan
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() =>
                      socket.emit("toggle-dispatch-state", {
                        sessionId,
                        status: false,
                      })
                    }
                    disabled={!isDispatchRunning}
                  >
                    ⏸ Hold Scan
                  </button>
                  <button
                    className="btn-danger"
                    style={{ background: "#94a3b8" }}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Are you sure you want to completely clear Dispatch Data?",
                        )
                      ) {
                        socket.emit("clear-dispatch-data", sessionId);
                      }
                    }}
                  >
                    🗑️ Clear
                  </button>
                </div>
              </div>

              {dispatchData.map((store) => {
                const total = store.ExpectedCartons.length;
                const accepted = store.AcceptedCartons.length;
                const pending = total - accepted;
                const isComplete = pending === 0 && total > 0;

                return (
                  <div
                    key={store.StoreName}
                    className={`tracker-card ${isComplete ? "completed" : "active"}`}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <h3 style={{ margin: 0 }}>{store.StoreName}</h3>
                      {/* 🚀 REMOVED INPUT BOX. Pallet Number is Display Only */}
                      <span
                        style={{
                          background: "#e2e8f0",
                          padding: "5px 10px",
                          borderRadius: "5px",
                          fontWeight: "bold",
                          color: "#334155",
                        }}
                      >
                        📍 {store.PalletNumber}
                      </span>
                    </div>

                    <div className="tracker-stats">
                      <div
                        style={{ cursor: "pointer" }}
                        onClick={() => openDispatchDetails(store, "Pending")}
                      >
                        <h4 style={{ color: "#64748b" }}>{pending}</h4>
                        <small>⏳ Pending</small>
                      </div>
                      <div
                        style={{ cursor: "pointer" }}
                        onClick={() => openDispatchDetails(store, "Accepted")}
                      >
                        <h4 style={{ color: "#10b981" }}>{accepted}</h4>
                        <small>✅ Accepted</small>
                      </div>
                      <div
                        style={{ cursor: "pointer" }}
                        onClick={() => openDispatchDetails(store, "Alerts")}
                      >
                        <h4 style={{ color: "#ef4444" }}>
                          {store.RejectedCartons.length}
                        </h4>
                        <small>❌ Alerts</small>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
      </div>
      <button className="fab-button" onClick={() => setShowInstructions(true)}>
        ?
      </button>
    </div>
  );
};

export default AdminDashboard;
