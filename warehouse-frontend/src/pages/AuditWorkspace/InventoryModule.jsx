import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import BarcodeScanner from "../../components/BarcodeScanner";

const InventoryModule = (props) => {
  const {
    step,
    setStep,
    sessionId,
    handleExitSession,
    renderInstructions,
    isAuditRunning,
    allProducts,
    cameraMode,
    setCameraMode,
    updateProductState,
    filteredProducts,
    currentIndex,
    alertModal,
    setAlertModal,
    zones,
    completedZones,
    unlockedZones,
    handleZoneSelect,
    getButtonStyle,
    selectedZone,
    getLocationsForZone,
    completedLocations,
    unlockedLocations,
    handleLocationSelect,
    isZoneCompletionModalOpen,
    setIsZoneCompletionModalOpen,
    confirmZoneCompletion,
    modal,
    setModal,
    saveModalData,
    isCompletionModalOpen,
    confirmLocationCompletion,
    setIsCompletionModalOpen,
    isFlagConfirmModalOpen,
    setIsFlagConfirmModalOpen,
    handleAuditAction,
    handleDragEnd,
    resetManualBarcode,
    changeBarcodePhaseState,
  } = props;

  // Audit on hold screen
  if (
    !isAuditRunning &&
    allProducts.length > 0 &&
    (step === "zone-select" || step === "location-select" || step === "audit")
  ) {
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
            Exit
          </button>
        </div>
        {renderInstructions()}
        <h1 style={{ fontSize: "60px", margin: "0" }}>⏸</h1>
        <h2 style={{ color: "#fca5a5", marginTop: "20px" }}>
          Audit is on Hold
        </h2>
        <p className="text-muted">Admin has paused the session...</p>
        <button
          className="btn-secondary"
          onClick={() => setStep("module-select")}
          style={{ marginTop: "20px" }}
        >
          ⬅ Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="screen-container bg-light" style={{ overflowY: "auto" }}>
      {cameraMode === "inventory" && (
        <BarcodeScanner
          onScan={(code) =>
            updateProductState(
              filteredProducts[currentIndex].uid,
              "ActualBarcode",
              code,
              { barcodePhase: 2 },
            )
          }
          onClose={() => setCameraMode(null)}
        />
      )}

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
      {renderInstructions()}

      {step === "zone-select" && (
        <>
          <div className="top-nav">
            <button
              className="btn-text"
              onClick={() => setStep("module-select")}
            >
              ⬅ Menu
            </button>
            <span className="font-bold">
              Team ID: <span style={{ color: "#3b82f6" }}>{sessionId}</span>
            </span>
          </div>
          <div
            className="card-box text-center mt-5"
            style={{ padding: "15px 10px", maxWidth: "100%" }}
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
                    style={{ ...getButtonStyle(isDone, isUnlocked) }}
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
        </>
      )}

      {step === "location-select" && (
        <>
          <div className="top-nav">
            <button className="btn-text" onClick={() => setStep("zone-select")}>
              ⬅ Zones
            </button>
            <span className="font-bold">Zone: {selectedZone}</span>
          </div>
          <div
            className="card-box text-center mt-5"
            style={{ maxWidth: "100%" }}
          >
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
            <div className="zone-grid mt-2" style={{ padding: 0 }}>
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
        </>
      )}

      {step === "audit" && (
        <div className="overflow-hidden">
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
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <small style={{ margin: 0 }}>Barcode Verification</small>
                      <button
                        className="btn-text sm"
                        onClick={() => setCameraMode("inventory")}
                        style={{ padding: 0 }}
                      >
                        📷 Camera Scan
                      </button>
                    </div>
                    {filteredProducts[currentIndex]?.barcodePhase === 2 ? (
                      <div>
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
    </div>
  );
};

export default InventoryModule;
