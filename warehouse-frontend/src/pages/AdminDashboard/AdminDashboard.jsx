import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import * as XLSX from "xlsx";

import AdminLogin from "./AdminLogin";
import AdminInventoryTab from "./AdminInventoryTab";
import AdminDispatchTab from "./AdminDispatchTab";

import AlertModal from "../../components/AlertModal";
import CustomButton from "../../components/CustomButton";
import Loader from "../../components/Loader";

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

  const [isLoading, setIsLoading] = useState(false);

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

  // MODALS
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
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result), {
          type: "array",
        });
        const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
          raw: false,
        });
        if (jsonData.length === 0) {
          setIsLoading(false);
          return showAlert("File is empty!", "error");
        }

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
            setIsLoading(false);
          });
      } catch (err) {
        showAlert("Parsing failed: " + err.message, "error");
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleDispatchUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result), {
          type: "array",
        });
        const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
          raw: false,
        });
        if (jsonData.length === 0) {
          setIsLoading(false);
          return showAlert("File is empty!", "error");
        }

        const mergedMap = {};
        dispatchData.forEach((pallet) => {
          mergedMap[pallet.PalletNumber] = {
            StoreName: pallet.StoreName,
            ExpectedCartons: [...pallet.ExpectedCartons],
            AcceptedCartons: [...pallet.AcceptedCartons],
            RejectedCartons: [...pallet.RejectedCartons],
            ScannedBy: { ...pallet.ScannedBy },
          };
        });

        jsonData.forEach((row) => {
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
          } else if (Array.isArray(rawCartons)) {
            cartonsArray = rawCartons.map(String);
          } else if (rawCartons) {
            cartonsArray = [String(rawCartons)];
          }

          if (mergedMap[palletNumber]) {
            cartonsArray.forEach((newCarton) => {
              if (
                !mergedMap[palletNumber].ExpectedCartons.includes(newCarton)
              ) {
                mergedMap[palletNumber].ExpectedCartons.push(newCarton);
              }
            });
          } else {
            mergedMap[palletNumber] = {
              StoreName: storeName,
              ExpectedCartons: cartonsArray,
              AcceptedCartons: [],
              RejectedCartons: [],
              ScannedBy: {},
            };
          }
        });

        const formattedDispatch = Object.keys(mergedMap).map(
          (palletNumber) => ({
            StoreName: mergedMap[palletNumber].StoreName,
            PalletNumber: palletNumber,
            ExpectedCartons: mergedMap[palletNumber].ExpectedCartons,
            AcceptedCartons: mergedMap[palletNumber].AcceptedCartons,
            RejectedCartons: mergedMap[palletNumber].RejectedCartons,
            ScannedBy: mergedMap[palletNumber].ScannedBy,
          }),
        );

        socket.emit("update-dispatch-excel", {
          sessionId,
          excelData: formattedDispatch,
        });

        showAlert(
          "Excel Merged Safely! Old pending tasks & scanned items are fully retained.",
          "success",
        );
        setIsLoading(false);
      } catch (err) {
        showAlert("Parsing failed: " + err.message, "error");
        setIsLoading(false);
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

  // 🔥 Ee function lo nunchi data clear ayye logic ni remove chesanu
  const executeLogoutAndClear = () => {
    if (sessionId) socket.emit("leave-session", sessionId);
    setSessionId("");
    localStorage.removeItem("adminSessionId");
    setAlertModal({ isOpen: false, message: "", type: "info" });
  };

  const getLocationsForAdminZone = () =>
    [
      ...new Set(
        masterData
          .filter((p) => String(p.Zone) === String(selectedZoneAdmin))
          .map((p) => p.Location),
      ),
    ].sort();
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
        background: "var(--success-color)",
        color: "white",
        borderColor: "var(--success-hover)",
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
      color: "var(--text-main)",
      borderColor: "var(--border-color)",
      cursor: "pointer",
    };
  };

  if (!sessionId) {
    return (
      <>
        {alertModal.isOpen && (
          <AlertModal
            isOpen={alertModal.isOpen}
            type={alertModal.type}
            message={alertModal.message}
            onClose={() =>
              setAlertModal({ isOpen: false, message: "", type: "info" })
            }
            onConfirm={() =>
              setAlertModal({ isOpen: false, message: "", type: "info" })
            }
          />
        )}
        <AdminLogin
          inputSessionId={inputSessionId}
          setInputSessionId={setInputSessionId}
          handleJoinOrCreate={handleJoinOrCreate}
        />
      </>
    );
  }

  return (
    <div className="screen-container bg-light" style={{ overflowY: "auto" }}>
      {/* 🚀 Loading state true ayithe, Loader modal render avuthundi */}
      {isLoading && <Loader text="Processing Excel File, Please wait..." />}

      {/* 🚀 MODALS START */}
      {alertModal.isOpen && (
        <AlertModal
          isOpen={alertModal.isOpen}
          type={alertModal.type}
          message={alertModal.message}
          onClose={() => setAlertModal({ isOpen: false })}
          onConfirm={executeLogoutAndClear}
        />
      )}

      {dispatchDetailsModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card" style={{ maxWidth: "450px" }}>
            <h3
              style={{
                borderBottom: "1px solid var(--border-color)",
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
                  <b style={{ color: "var(--text-main)", fontSize: "15px" }}>
                    📦 {item.carton}
                  </b>{" "}
                  <br />
                  <span
                    style={{
                      color: "var(--text-muted)",
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
              className="btn-primary full-width mt-4"
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
            <h3 style={{ color: "var(--primary-color)", textAlign: "center" }}>
              📖 Admin Guide
            </h3>
            <div className="instructions-content" style={{ marginTop: "15px" }}>
              <p style={{ color: "var(--text-muted)" }}>
                Share your <b>Team ID</b> ({sessionId}) with the users. Use
                Start/Hold controls to manage access.
              </p>
            </div>
            <button
              className="btn-primary full-width mt-4"
              onClick={() => setShowInstructions(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
      {/* 🚀 MODALS END */}

      <div className="top-nav" style={{ flexWrap: "wrap", gap: "10px" }}>
        <span className="font-bold">
          Team ID: <b style={{ color: "var(--primary-color)" }}>{sessionId}</b>
        </span>
        <div style={{ display: "flex", gap: "10px" }}>
          {masterData.length > 0 && activeTab === "inventory" && (
            <button className="btn-success sm" onClick={handleExportData}>
              📥 Export Excel
            </button>
          )}
          <CustomButton
            text="Log Out"
            variant="danger"
            size="sm"
            onClick={() =>
              setAlertModal({
                isOpen: true,
                // 🔥 Message ni marchanu. Users thappu ga ardham cheskokunda
                message:
                  "Are you sure you want to log out? (Data will remain safe in Database)",
                type: "confirm_logout",
              })
            }
          />
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

        {activeTab === "inventory" && (
          <AdminInventoryTab
            masterData={masterData}
            handleInventoryUpload={handleInventoryUpload}
            isAuditRunning={isAuditRunning}
            socket={socket}
            sessionId={sessionId}
            selectedZoneAdmin={selectedZoneAdmin}
            setSelectedZoneAdmin={setSelectedZoneAdmin}
            zones={zones}
            completedZones={completedZones}
            unlockedZones={unlockedZones}
            getButtonStyle={getButtonStyle}
            handleUnlockZone={handleUnlockZone}
            getLocationsForAdminZone={getLocationsForAdminZone}
            completedLocations={completedLocations}
            unlockedLocations={unlockedLocations}
            handleUnlockLocation={handleUnlockLocation}
          />
        )}

        {activeTab === "dispatch" && (
          <AdminDispatchTab
            dispatchData={dispatchData}
            handleDispatchUpload={handleDispatchUpload}
            isDispatchRunning={isDispatchRunning}
            socket={socket}
            sessionId={sessionId}
            openDispatchDetails={openDispatchDetails}
          />
        )}
      </div>

      <button className="fab-button" onClick={() => setShowInstructions(true)}>
        ?
      </button>
    </div>
  );
};

export default AdminDashboard;
