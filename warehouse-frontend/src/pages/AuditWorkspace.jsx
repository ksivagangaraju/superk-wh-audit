import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import io from "socket.io-client";

const BACKEND_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.startsWith("192.168")
    ? "http://localhost:5001"
    : "https://superk-wh-audit.onrender.com";
const socket = io(BACKEND_URL);

const AuditWorkspace = () => {
  const [sessionId, setSessionId] = useState(
    localStorage.getItem("userSessionId") || "",
  );
  const [inputSessionId, setInputSessionId] = useState("");

  const [step, setStep] = useState(sessionId ? "zone-select" : "join");

  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [zones, setZones] = useState([]);
  const [completedZones, setCompletedZones] = useState([]);
  const [unlockedZones, setUnlockedZones] = useState([]);
  const [completedLocations, setCompletedLocations] = useState([]);
  const [unlockedLocations, setUnlockedLocations] = useState([]);

  const [selectedZone, setSelectedZone] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isAuditRunning, setIsAuditRunning] = useState(false);

  const [modal, setModal] = useState({
    isOpen: false,
    field: "",
    value: "",
    title: "",
  });
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [isFlagConfirmModalOpen, setIsFlagConfirmModalOpen] = useState(false);
  const [isZoneCompletionModalOpen, setIsZoneCompletionModalOpen] =
    useState(false);
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: "",
    type: "info",
  });

  const showAlert = (message, type = "info") =>
    setAlertModal({ isOpen: true, message, type });

  const fetchSessionData = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/status/${sessionId}`);
      const data = await res.json();

      if (data.error) {
        handleExitSession();
        return showAlert("Session is invalid or closed by Admin.", "error");
      }

      if (!data.masterData || data.masterData.length === 0) {
        setStep("waiting");
        return;
      }

      setZones(data.zones || []);
      setCompletedZones(data.completedZones || []);
      setUnlockedZones(data.unlockedZones || []);
      setCompletedLocations(data.completedLocations || []);
      setUnlockedLocations(data.unlockedLocations || []);
      setIsAuditRunning(data.isAuditRunning || false);
      if (data.masterData) {
        setAllProducts(
          data.masterData.map((item) => ({
            ...item,
            barcodePhase: item.barcodePhase || 0,
          })),
        );
      }

      if (step === "join" || step === "waiting") setStep("zone-select");
    } catch (err) {
      console.error("Error connecting:", err);
      handleExitSession();
    }
  };

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("userSessionId", sessionId);
      socket.emit("join-session", sessionId);
      fetchSessionData();
    }
  }, [sessionId]);

  useEffect(() => {
    socket.on("zone-status-changed", (data) => {
      setCompletedZones(data.completedZones || []);
      setUnlockedZones(data.unlockedZones || []);
    });
    socket.on("location-status-changed", (data) => {
      setCompletedLocations(data.completedLocations || []);
      setUnlockedLocations(data.unlockedLocations || []);
    });
    socket.on("audit-state-changed", (status) => setIsAuditRunning(status));

    socket.on("data-uploaded", () => {
      fetchSessionData();
    });

    socket.on("session-cleared", () => {
      showAlert("Admin has logged out. Session closed.", "info");
      handleExitSession();
    });

    return () => {
      socket.off("zone-status-changed");
      socket.off("location-status-changed");
      socket.off("audit-state-changed");
      socket.off("session-cleared");
      socket.off("data-uploaded");
    };
  }, [sessionId]);

  const handleJoinSession = () => {
    if (inputSessionId.trim().length >= 6) {
      setSessionId(inputSessionId.trim());
    } else {
      showAlert("Team ID must be at least 6 characters long.", "error");
    }
  };

  const handleExitSession = () => {
    if (sessionId) {
      socket.emit("leave-session", sessionId);
    }
    setSessionId("");
    localStorage.removeItem("userSessionId");
    setStep("join");
  };

  const handleZoneSelect = (zone) => {
    setSelectedZone(zone);
    setStep("location-select");
  };

  const getLocationsForZone = () => {
    const itemsInZone = allProducts.filter(
      (p) => String(p.Zone) === String(selectedZone),
    );
    return [...new Set(itemsInZone.map((p) => p.Location))].sort();
  };

  const handleLocationSelect = (loc) => {
    setSelectedLocation(loc);
    const filtered = allProducts.filter(
      (p) =>
        String(p.Zone) === String(selectedZone) &&
        String(p.Location) === String(loc),
    );

    if (filtered.length === 0) return showAlert(`No items in ${loc}`, "error");

    setFilteredProducts(filtered);
    setCurrentIndex(0);
    setStep("audit");
  };

  const updateProductState = (uid, field, value, extraFields = {}) => {
    const updatedFiltered = filteredProducts.map((p) => {
      if (p.uid === uid) {
        const updatedItem = { ...p, [field]: value, ...extraFields };
        socket.emit("update-item", { sessionId, updatedItem });
        return updatedItem;
      }
      return p;
    });
    setFilteredProducts(updatedFiltered);

    const updatedAll = allProducts.map((p) =>
      p.uid === uid ? { ...p, [field]: value, ...extraFields } : p,
    );
    setAllProducts(updatedAll);
  };

  const saveModalData = () => {
    const currentItem = filteredProducts[currentIndex];
    let extra = modal.field === "ActualBarcode" ? { barcodePhase: 2 } : {};
    updateProductState(currentItem.uid, modal.field, modal.value, extra);
    setModal({ ...modal, isOpen: false });
  };

  const changeBarcodePhaseState = (phaseNum) => {
    updateProductState(
      filteredProducts[currentIndex].uid,
      "barcodePhase",
      phaseNum,
    );
  };

  const resetManualBarcode = () => {
    updateProductState(
      filteredProducts[currentIndex].uid,
      "ActualBarcode",
      "",
      { barcodePhase: 0 },
    );
  };

  const handleAuditAction = (status) => {
    updateProductState(
      filteredProducts[currentIndex].uid,
      "AuditStatus",
      status,
    );
    if (currentIndex < filteredProducts.length - 1)
      setCurrentIndex((prev) => prev + 1);
    else setIsCompletionModalOpen(true);
  };

  const confirmLocationCompletion = () => {
    const locationKey = `${selectedZone}___${selectedLocation}`;
    socket.emit("mark-location-complete", { sessionId, locationKey });
    setIsCompletionModalOpen(false);
    setStep("location-select");
  };

  const confirmZoneCompletion = () => {
    socket.emit("mark-zone-complete", { sessionId, zoneName: selectedZone });
    setIsZoneCompletionModalOpen(false);
    setStep("zone-select");
  };

  const handleDragEnd = (e, info) => {
    const x = info.offset.x;
    const y = info.offset.y;
    if (y > 80 || (y > 50 && Math.abs(x) > 40)) setIsFlagConfirmModalOpen(true);
    else if (x < -80) handleAuditAction("Verified");
    else if (x > 80 && currentIndex > 0) setCurrentIndex((prev) => prev - 1);
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

  if (step === "join") {
    return (
      <div
        className="screen-container bg-dark text-center"
        style={{ justifyContent: "center" }}
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
        <div className="card-box" style={{ margin: "0" }}>
          <h2>👷 User Access</h2>
          <p className="text-muted mt-2">
            Enter the Team ID provided by your Admin
          </p>
          <input
            type="text"
            placeholder="Team ID (min 6 chars)"
            value={inputSessionId}
            onChange={(e) => setInputSessionId(e.target.value)}
            className="modal-input mt-2"
          />
          <button
            className="btn-primary full-width"
            onClick={handleJoinSession}
          >
            Connect to Audit
          </button>
        </div>
      </div>
    );
  }

  if (step === "waiting") {
    return (
      <div
        className="screen-container bg-dark text-center"
        style={{ justifyContent: "center", position: "relative" }}
      >
        <div
          className="top-nav"
          style={{
            position: "absolute",
            top: 0,
            width: "100%",
            background: "rgba(15, 23, 42, 0.9)",
            borderBottom: "1px solid #334155",
          }}
        >
          <span className="font-bold" style={{ color: "white" }}>
            Team ID: <span style={{ color: "#3b82f6" }}>{sessionId}</span>
          </span>
          <button
            className="btn-text danger"
            style={{ color: "#ef4444" }}
            onClick={handleExitSession}
          >
            Exit Session
          </button>
        </div>
        <h1 style={{ fontSize: "60px", margin: "0" }}>⏳</h1>
        <h2 style={{ color: "#fcd34d", marginTop: "20px" }}>
          Waiting for Admin
        </h2>
        <p className="text-muted" style={{ padding: "0 15px" }}>
          Session is created, but the Master Excel File hasn't been uploaded
          yet. This screen will auto-refresh when it's ready!
        </p>
      </div>
    );
  }

  if (!isAuditRunning && allProducts.length > 0) {
    return (
      <div
        className="screen-container bg-dark text-center"
        style={{ justifyContent: "center", position: "relative" }}
      >
        <div
          className="top-nav"
          style={{
            position: "absolute",
            top: 0,
            width: "100%",
            background: "rgba(15, 23, 42, 0.9)",
            borderBottom: "1px solid #334155",
          }}
        >
          <span className="font-bold" style={{ color: "white" }}>
            Team ID: <span style={{ color: "#3b82f6" }}>{sessionId}</span>
          </span>
          <button
            className="btn-text danger"
            style={{ color: "#ef4444" }}
            onClick={handleExitSession}
          >
            Exit Session
          </button>
        </div>
        <h1 style={{ fontSize: "60px", margin: "0" }}>⏸</h1>
        <h2 style={{ color: "#fca5a5", marginTop: "20px" }}>
          Audit is on Hold
        </h2>
        <p className="text-muted">Admin has paused the session...</p>
      </div>
    );
  }

  return (
    <>
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

      {step === "zone-select" && (
        <div
          className="screen-container bg-light"
          style={{ overflowY: "auto" }}
        >
          <div className="top-nav">
            <span className="font-bold">
              Team ID: <span style={{ color: "#3b82f6" }}>{sessionId}</span>
            </span>
            <button className="btn-text danger" onClick={handleExitSession}>
              Exit
            </button>
          </div>
          <div
            className="card-box text-center mt-5"
            style={{ padding: "15px 10px" }}
          >
            <h2 style={{ marginBottom: "20px" }}>Select Zone</h2>
            <div className="zone-grid" style={{ padding: 0 }}>
              {zones.map((zone) => {
                const isDone = completedZones.includes(zone);
                const isUnlocked = unlockedZones.includes(zone);
                return (
                  <button
                    key={zone}
                    className="btn-zone"
                    onClick={() => handleZoneSelect(zone)}
                    disabled={isDone}
                    style={{
                      ...getButtonStyle(isDone, isUnlocked),
                    }}
                  >
                    {zone} <br />{" "}
                    <span style={{ fontSize: "13px", fontWeight: "normal" }}>
                      {isDone
                        ? "✅ Locked"
                        : isUnlocked
                          ? "🔄 Correction"
                          : "⏳ Active"}
                    </span>
                  </button>
                );
              })}
            </div>
            {zones.length === 0 && (
              <p className="text-muted mt-2">No Zones loaded yet.</p>
            )}
          </div>
        </div>
      )}

      {step === "location-select" && (
        <div
          className="screen-container bg-light"
          style={{ overflowY: "auto" }}
        >
          <div className="top-nav">
            <button className="btn-text" onClick={() => setStep("zone-select")}>
              ⬅ Zones
            </button>
            <span className="font-bold">Zone: {selectedZone}</span>
          </div>
          <div className="card-box text-center mt-5">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <p className="text-muted" style={{ margin: 0 }}>
                Select location
              </p>
              <button
                className="btn-success sm"
                onClick={() => setIsZoneCompletionModalOpen(true)}
              >
                ✅ Lock Zone
              </button>
            </div>

            <div className="zone-grid mt-2">
              {getLocationsForZone().map((loc) => {
                const locKey = `${selectedZone}___${loc}`;
                const isDone = completedLocations.includes(locKey);
                const isUnlocked = unlockedLocations.includes(locKey);
                return (
                  <button
                    key={loc}
                    className="btn-zone"
                    disabled={isDone}
                    onClick={() => handleLocationSelect(loc)}
                    style={{ ...getButtonStyle(isDone, isUnlocked) }}
                  >
                    {loc} <br />{" "}
                    <span style={{ fontSize: "13px", fontWeight: "normal" }}>
                      {isDone
                        ? "✅ Locked"
                        : isUnlocked
                          ? "🔄 Correction"
                          : "⏳ Active"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {isZoneCompletionModalOpen && (
            <div className="modal-overlay">
              <div className="modal-card text-center">
                <h3 style={{ color: "#10b981" }}>✅ Lock Entire Zone?</h3>
                <p style={{ margin: "15px 0" }}>
                  Are you sure you have completed all locations in Zone{" "}
                  {selectedZone}?
                </p>
                <div className="modal-actions">
                  <button
                    className="btn-success full-width"
                    onClick={confirmZoneCompletion}
                  >
                    ✅ Lock Zone
                  </button>
                  <button
                    className="btn-secondary full-width"
                    onClick={() => setIsZoneCompletionModalOpen(false)}
                  >
                    ⬅ Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === "audit" && (
        <div className="screen-container bg-gray overflow-hidden">
          {modal.isOpen && (
            <div className="modal-overlay">
              <div className="modal-card">
                <h3>Update {modal.title}</h3>
                <input
                  type={
                    modal.title.includes("Qty") || modal.title.includes("MRP")
                      ? "number"
                      : modal.title.includes("Date")
                        ? "date"
                        : "text"
                  }
                  autoFocus
                  value={modal.value !== undefined ? modal.value : ""}
                  onChange={(e) =>
                    setModal({ ...modal, value: e.target.value })
                  }
                  className="modal-input"
                />
                <div className="modal-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => setModal({ ...modal, isOpen: false })}
                  >
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={saveModalData}>
                    💾 Save Update
                  </button>
                </div>
              </div>
            </div>
          )}

          {isCompletionModalOpen && (
            <div className="modal-overlay">
              <div className="modal-card text-center">
                <h3 style={{ color: "#10b981" }}>🎉 Location Done!</h3>
                <p style={{ margin: "15px 0" }}>
                  Are you sure you want to lock location {selectedLocation}?
                </p>
                <div className="modal-actions">
                  <button
                    className="btn-success full-width"
                    onClick={confirmLocationCompletion}
                  >
                    ✅ Lock
                  </button>
                  <button
                    className="btn-secondary full-width"
                    onClick={() => setIsCompletionModalOpen(false)}
                  >
                    ⬅ Back
                  </button>
                </div>
              </div>
            </div>
          )}

          {isFlagConfirmModalOpen && (
            <div className="modal-overlay">
              <div className="modal-card text-center">
                <h3 style={{ color: "#ef4444" }}>⚠️ Flag Mismatch</h3>
                <p style={{ margin: "15px 0" }}>Confirm mismatch entry?</p>
                <div className="modal-actions">
                  <button
                    className="btn-danger full-width"
                    onClick={() => {
                      setIsFlagConfirmModalOpen(false);
                      handleAuditAction("Discrepancy");
                    }}
                  >
                    🚨 Flag
                  </button>
                  <button
                    className="btn-secondary full-width"
                    onClick={() => setIsFlagConfirmModalOpen(false)}
                  >
                    ❌ Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="top-nav shadow-sm">
            <button
              className="btn-text"
              onClick={() => setStep("location-select")}
            >
              ⬅ Locations
            </button>
            <span className="font-bold">
              Item: {currentIndex + 1} / {filteredProducts.length}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              className="slide-container"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.5}
              onDragEnd={handleDragEnd}
            >
              <div className="audit-card">
                <div className="card-header">
                  <span className="tag-location">
                    📍 Loc: {filteredProducts[currentIndex]?.Location}
                  </span>
                  <span
                    className={`tag-status ${String(filteredProducts[currentIndex]?.AuditStatus || "Pending").toLowerCase()}`}
                  >
                    {filteredProducts[currentIndex]?.AuditStatus || "Pending"}
                  </span>
                </div>

                <h2 className="product-title">
                  {filteredProducts[currentIndex]?.ProductName}
                </h2>

                <div className="data-grid">
                  <div
                    className={`data-box ${filteredProducts[currentIndex]?.ActualQty !== filteredProducts[currentIndex]?.SystemQty ? "modified" : ""}`}
                    onClick={() =>
                      setModal({
                        isOpen: true,
                        field: "ActualQty",
                        value: filteredProducts[currentIndex]?.ActualQty,
                        title: "Physical Qty",
                      })
                    }
                  >
                    <small>Qty (Tap to Edit)</small>
                    <h3>{filteredProducts[currentIndex]?.ActualQty}</h3>
                    {filteredProducts[currentIndex]?.ActualQty !==
                      filteredProducts[currentIndex]?.SystemQty && (
                      <span className="orig-val">
                        Sys: {filteredProducts[currentIndex]?.SystemQty}
                      </span>
                    )}
                  </div>
                  <div
                    className={`data-box ${filteredProducts[currentIndex]?.ActualMRP !== filteredProducts[currentIndex]?.SystemMRP ? "modified" : ""}`}
                    onClick={() =>
                      setModal({
                        isOpen: true,
                        field: "ActualMRP",
                        value: filteredProducts[currentIndex]?.ActualMRP,
                        title: "MRP",
                      })
                    }
                  >
                    <small>MRP (Tap to Edit)</small>
                    <h3>₹{filteredProducts[currentIndex]?.ActualMRP}</h3>
                    {filteredProducts[currentIndex]?.ActualMRP !==
                      filteredProducts[currentIndex]?.SystemMRP && (
                      <span className="orig-val">
                        Sys: ₹{filteredProducts[currentIndex]?.SystemMRP}
                      </span>
                    )}
                  </div>
                  <div
                    className={`data-box full-span ${filteredProducts[currentIndex]?.ActualExpDate !== filteredProducts[currentIndex]?.SystemExpDate ? "modified" : ""}`}
                    onClick={() =>
                      setModal({
                        isOpen: true,
                        field: "ActualExpDate",
                        value: filteredProducts[currentIndex]?.ActualExpDate,
                        title: "Expiry Date",
                      })
                    }
                  >
                    <small>Exp Date (Tap to Edit)</small>
                    <h3>
                      {filteredProducts[currentIndex]?.ActualExpDate ||
                        "No Date"}
                    </h3>
                    {filteredProducts[currentIndex]?.ActualExpDate !==
                      filteredProducts[currentIndex]?.SystemExpDate && (
                      <span className="orig-val">
                        Sys: {filteredProducts[currentIndex]?.SystemExpDate}
                      </span>
                    )}
                  </div>

                  <div className="data-box full-span">
                    <small>Barcode Verification</small>
                    {filteredProducts[currentIndex]?.barcodePhase === 2 ? (
                      <div className>
                        <h3 className="text-success">
                          {filteredProducts[currentIndex]?.ActualBarcode}
                        </h3>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: "10px",
                            marginTop: "10px",
                          }}
                        >
                          <button
                            className="btn-text sm"
                            onClick={() =>
                              setModal({
                                isOpen: true,
                                field: "ActualBarcode",
                                value:
                                  filteredProducts[currentIndex]?.ActualBarcode,
                                title: "Physical Barcode",
                              })
                            }
                          >
                            ✎ Edit
                          </button>
                          <button
                            className="btn-text sm danger"
                            onClick={resetManualBarcode}
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bc-logic-view">
                        <h3>
                          {filteredProducts[currentIndex]?.barcodePhase === 0
                            ? filteredProducts[currentIndex]?.Barcode1
                            : filteredProducts[currentIndex]?.Barcode2}
                        </h3>
                        <div className="bc-actions">
                          {filteredProducts[currentIndex]?.barcodePhase === 0 &&
                            filteredProducts[currentIndex]?.Barcode1 !==
                              filteredProducts[currentIndex]?.Barcode2 &&
                            filteredProducts[currentIndex]?.Barcode2 !==
                              "N/A" &&
                            filteredProducts[currentIndex]?.Barcode2 && (
                              <button
                                className="btn-chip btn-wrong"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  changeBarcodePhaseState(1);
                                }}
                              >
                                ❌ Wrong?
                              </button>
                            )}
                          {filteredProducts[currentIndex]?.barcodePhase ===
                            1 && (
                            <button
                              className="btn-chip btn-back"
                              onClick={(e) => {
                                e.stopPropagation();
                                changeBarcodePhaseState(0);
                              }}
                            >
                              ⬅ Back B1
                            </button>
                          )}
                          <button
                            className="btn-chip btn-manual"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModal({
                                isOpen: true,
                                field: "ActualBarcode",
                                value: "",
                                title: "Physical Barcode",
                              });
                            }}
                          >
                            ✎ Manual
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="tinder-hints">
                  <div className="hint-row">
                    <span className="hint-undo">⬅ Verify Match</span>
                    <span className="hint-right">Undo / Back ➡</span>
                  </div>
                  <div
                    className="hint-down"
                    style={{
                      textAlign: "center",
                      color: "#ef4444",
                      marginTop: "10px",
                    }}
                  >
                    ⬇ Swipe Down to Flag Mistake
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </>
  );
};
export default AuditWorkspace;
