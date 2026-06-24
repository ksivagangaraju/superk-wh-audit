import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import io from "socket.io-client";

const socket = io("https://superk-wh-audit.onrender.com");

const AuditWorkspace = () => {
  const [step, setStep] = useState("zone-select");
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [zones, setZones] = useState([]);
  const [completedZones, setCompletedZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isAuditRunning, setIsAuditRunning] = useState(false);

  // Modals States
  const [modal, setModal] = useState({
    isOpen: false,
    field: "",
    value: "",
    title: "",
  });
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [isFlagConfirmModalOpen, setIsFlagConfirmModalOpen] = useState(false);

  // Custom Alert Modal State
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: "",
    type: "info",
  });

  const showAlert = (message, type = "info") => {
    setAlertModal({ isOpen: true, message, type });
  };

  const fetchSessionData = async () => {
    try {
      const res = await fetch(
        "https://superk-wh-audit.onrender.com/api/status",
      );
      const data = await res.json();
      setZones(data.zones || []);
      setCompletedZones(data.completedZones || []);
      setIsAuditRunning(data.isAuditRunning || false);
      if (data.masterData && data.masterData.length > 0) {
        const initializedData = data.masterData.map((item) => ({
          ...item,
          barcodePhase: item.barcodePhase !== undefined ? item.barcodePhase : 0,
        }));
        setAllProducts(initializedData);
      }
    } catch (err) {
      console.error("Error connecting to backend server:", err);
    }
  };

  useEffect(() => {
    fetchSessionData();

    socket.on("zone-status-changed", (data) =>
      setCompletedZones(data.completedZones || []),
    );
    socket.on("audit-state-changed", (status) => setIsAuditRunning(status));

    socket.on("data-updated", (data) => {
      setZones(data.zones || []);
      setCompletedZones(data.completedZones || []);
      setIsAuditRunning(data.isAuditRunning || false);

      setFilteredProducts([]);
      setCurrentIndex(0);
      setStep("zone-select");

      if (data.masterData && data.masterData.length > 0) {
        const initializedData = data.masterData.map((item) => ({
          ...item,
          barcodePhase: 0,
        }));
        setAllProducts(initializedData);
      }
      showAlert(
        "Admin has uploaded a new stock data file! Your workspace has been reset to start fresh.",
        "info",
      );
    });

    return () => {
      socket.off("zone-status-changed");
      socket.off("audit-state-changed");
      socket.off("data-updated");
    };
  }, []);

  const handleZoneSelect = (zone) => {
    if (!allProducts || allProducts.length === 0) {
      fetchSessionData();
      return showAlert(
        "Admin has not uploaded the master file yet! Please wait...",
        "error",
      );
    }
    processZoneFiltering(zone);
  };

  const processZoneFiltering = (zone) => {
    setSelectedZone(zone);
    const filteredAndSorted = allProducts
      .filter((p) => String(p.Zone) === String(zone))
      .sort((a, b) => String(a.Location).localeCompare(String(b.Location)));

    if (filteredAndSorted.length === 0) {
      return showAlert(`Selected Zone ${zone} has no records.`, "error");
    }

    setFilteredProducts(filteredAndSorted);
    setCurrentIndex(0);
    setStep("audit");
  };

  const updateProductState = (uid, field, value, extraFields = {}) => {
    const updatedFiltered = filteredProducts.map((p) => {
      if (p.uid === uid) {
        const updatedItem = { ...p, [field]: value, ...extraFields };
        socket.emit("update-item", updatedItem);
        return updatedItem;
      }
      return p;
    });
    setFilteredProducts(updatedFiltered);

    const updatedAll = allProducts.map((p) => {
      if (p.uid === uid) return { ...p, [field]: value, ...extraFields };
      return p;
    });
    setAllProducts(updatedAll);
  };

  const saveModalData = () => {
    const currentItem = filteredProducts[currentIndex];
    let extra = {};
    if (modal.field === "ActualBarcode") extra.barcodePhase = 2;
    updateProductState(currentItem.uid, modal.field, modal.value, extra);
    setModal({ ...modal, isOpen: false });
  };

  const changeBarcodePhaseState = (phaseNum) => {
    const currentItem = filteredProducts[currentIndex];
    updateProductState(currentItem.uid, "barcodePhase", phaseNum);
  };

  const resetManualBarcode = () => {
    const currentItem = filteredProducts[currentIndex];
    updateProductState(currentItem.uid, "ActualBarcode", "", {
      barcodePhase: 0,
    });
  };

  const handleAuditAction = (status) => {
    const currentItem = filteredProducts[currentIndex];
    updateProductState(currentItem.uid, "AuditStatus", status);

    if (currentIndex < filteredProducts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompletionModalOpen(true);
    }
  };

  const confirmZoneCompletion = () => {
    socket.emit("mark-zone-complete", selectedZone);
    setIsCompletionModalOpen(false);
    setStep("zone-select");
  };

  const handleDragEnd = (event, info) => {
    const x = info.offset.x;
    const y = info.offset.y;

    if (y > 80 || (y > 50 && Math.abs(x) > 40)) {
      setIsFlagConfirmModalOpen(true);
    } else if (x < -80) {
      handleAuditAction("Verified");
    } else if (x > 80 && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  if (!isAuditRunning && allProducts.length > 0) {
    return (
      <div
        className="screen-container bg-dark text-center"
        style={{ justifyContent: "center", padding: "20px" }}
      >
        <h1 style={{ fontSize: "60px", margin: "0" }}>⏸</h1>
        <h2 style={{ color: "#fca5a5", marginTop: "20px" }}>
          Audit is on Hold
        </h2>
        <p
          className="text-muted"
          style={{ fontSize: "18px", marginTop: "10px" }}
        >
          Admin has temporarily paused the audit. Please wait until it
          resumes...
        </p>
      </div>
    );
  }

  return (
    <>
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

      {step === "zone-select" && (
        <div
          className="screen-container bg-light"
          style={{ overflowY: "auto" }}
        >
          <div className="top-nav">
            <span className="font-bold">👷 User Audit Workspace</span>
            <button className="btn-secondary" onClick={fetchSessionData}>
              🔄 Refresh Sync
            </button>
          </div>
          <div className="card-box text-center mt-5">
            <h2>Select Active Zone</h2>
            <div className="zone-grid mt-2">
              {zones.map((zone) => {
                const isZoneDone = completedZones.includes(zone);
                return (
                  <button
                    key={zone}
                    className={`btn-zone ${isZoneDone ? "completed" : ""}`}
                    onClick={() => handleZoneSelect(zone)}
                    disabled={isZoneDone}
                  >
                    {zone} {isZoneDone ? "✅" : ""}
                  </button>
                );
              })}
            </div>
            {zones.length === 0 && (
              <p
                className="text-muted"
                style={{
                  marginTop: "20px",
                  padding: "15px",
                  background: "#f1f5f9",
                  borderRadius: "10px",
                }}
              >
                No active master records session found. Waiting for Admin
                upload...
              </p>
            )}
          </div>
        </div>
      )}

      {step === "audit" && (
        <div
          className="screen-container bg-gray overflow-hidden"
          style={{ overflowY: "auto" }}
        >
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
                <h3 style={{ color: "#10b981" }}>🎉 Zone Audit Done!</h3>
                <p style={{ margin: "15px 0" }}>
                  Are you sure you want to confirm completion and lock this
                  zone?
                </p>
                <div
                  className="modal-actions"
                  style={{ flexDirection: "column", gap: "10px" }}
                >
                  <button
                    className="btn-success full-width"
                    onClick={confirmZoneCompletion}
                  >
                    ✅ Confirm & Complete
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
                <p
                  style={{
                    margin: "15px 0",
                    color: "#475569",
                    fontSize: "15px",
                    lineHeight: "1.4",
                  }}
                >
                  Are you sure you want to flag this item? A mismatch entry will
                  be registered.
                </p>
                <div
                  className="modal-actions"
                  style={{ flexDirection: "column", gap: "10px" }}
                >
                  <button
                    className="btn-danger full-width"
                    onClick={() => {
                      setIsFlagConfirmModalOpen(false);
                      handleAuditAction("Discrepancy");
                    }}
                  >
                    🚨 Confirm / Flag Mistake
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
            <button className="btn-text" onClick={() => setStep("zone-select")}>
              ⬅ Exit Zone
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
                    className={`tag-status ${filteredProducts[currentIndex]?.AuditStatus.toLowerCase()}`}
                  >
                    {filteredProducts[currentIndex]?.AuditStatus}
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
                      <div className="bc-manual-view">
                        <h3 className="text-success">
                          {filteredProducts[currentIndex]?.ActualBarcode}
                        </h3>
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
                          ✎ Edit Manual
                        </button>
                        <button
                          className="btn-text sm danger"
                          onClick={resetManualBarcode}
                        >
                          Reset
                        </button>
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
                    ⬇ Swipe Down/Diagonal to Flag Mistake
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
