import React, { useEffect } from "react";
import BarcodeScanner from "../../components/BarcodeScanner";

const DispatchModule = (props) => {
  const {
    step,
    setStep,
    sessionId,
    handleExitSession,
    renderInstructions,
    isDispatchRunning,
    dispatchData,
    cameraMode,
    setCameraMode,
    executeFindCarton,
    alertModal,
    setAlertModal,
    activePallet,
    setActivePallet,
    currentPalletInput,
    setCurrentPalletInput,
    handleEnterPallet,
    searchCartonInput,
    setSearchCartonInput,
    handleFindCartonSubmit,
    processCartonScan,
    dispatchDetailsModal,
    setDispatchDetailsModal,
    openDispatchDetails,
    handleScanSubmit,
    scanInputRef,
    cartonScanInput,
    setCartonScanInput,
  } = props;

  // 🔥 AUTO-CLOSE SUCCESS NOTIFICATION AFTER 1.5 SECONDS
  useEffect(() => {
    if (alertModal?.isOpen && alertModal?.type !== "error") {
      const timer = setTimeout(() => {
        setAlertModal({ isOpen: false, message: "", type: "info" });
      }, 1500); // 1.5 seconds
      return () => clearTimeout(timer);
    }
  }, [alertModal, setAlertModal]);

  // Dispatch on hold screen
  if (
    !isDispatchRunning &&
    dispatchData.length > 0 &&
    step.startsWith("dispatch")
  ) {
    return (
      <div
        className="screen-container bg-light text-center"
        style={{ justifyContent: "center", position: "relative" }}
      >
        <div className="top-nav">
          <span className="font-bold">
            Team ID:{" "}
            <span style={{ color: "var(--primary-color, #3b82f6)" }}>
              {sessionId}
            </span>
          </span>
          <button className="btn-text danger" onClick={handleExitSession}>
            Exit
          </button>
        </div>

        <div
          className="card-box"
          style={{
            margin: "auto",
            maxWidth: "400px",
            width: "100%",
            padding: "40px 20px",
          }}
        >
          <h1 style={{ fontSize: "60px", margin: "0" }}>⏸</h1>
          <h2
            style={{ color: "var(--danger-color, #ef4444)", marginTop: "20px" }}
          >
            Dispatch on Hold
          </h2>
          <p className="text-muted mt-2">
            Admin has paused the dispatch scan...
          </p>
          <button
            className="btn-secondary full-width mt-4"
            onClick={() => {
              setActivePallet(null);
              setStep("module-select");
            }}
          >
            ⬅ Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // Dispatch Pallet Selection Screen
  if (step === "dispatch-pallet") {
    return (
      <div className="screen-container bg-light text-center">
        {cameraMode === "dispatch-find" && (
          <BarcodeScanner
            onScan={(code) => executeFindCarton(code)}
            onClose={() => setCameraMode(null)}
          />
        )}

        {/* 🚀 SUCCESS NOTIFICATION (FLOATING TOP) */}
        {alertModal.isOpen && alertModal.type !== "error" && (
          <div
            style={{
              position: "fixed",
              top: "20px",
              left: "0",
              right: "0",
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none", // Focus tagilakunda vundataniki
              zIndex: 10000,
            }}
          >
            <div
              style={{
                background: "var(--success-color, #10b981)",
                color: "white",
                padding: "10px 20px",
                borderRadius: "30px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              {alertModal.message}
            </div>
          </div>
        )}

        {/* 🛑 ERROR MODAL (NEEDS OK BUTTON) */}
        {alertModal.isOpen && alertModal.type === "error" && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-card text-center">
              <h3 style={{ color: "var(--danger-color, #ef4444)" }}>
                ⚠️ Alert
              </h3>
              <p
                style={{
                  margin: "15px 0",
                  color: "var(--text-muted, #475569)",
                  whiteSpace: "pre-line",
                  fontWeight: "bold",
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

        {renderInstructions()}
        <div className="top-nav">
          <button className="btn-text" onClick={() => setStep("module-select")}>
            ⬅ Back
          </button>
          <span className="font-bold">Dispatch</span>
        </div>

        <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
          <div
            className="card-box"
            style={{ marginBottom: "20px", padding: "30px 20px" }}
          >
            <h3 style={{ marginBottom: "10px" }}>📍 Open Pallet</h3>
            <p
              className="text-muted"
              style={{ fontSize: "14px", marginBottom: "20px" }}
            >
              Enter Pallet No or Store Name
            </p>
            <input
              type="text"
              className="modal-input"
              placeholder="e.g. P-01"
              value={currentPalletInput}
              onChange={(e) => setCurrentPalletInput(e.target.value)}
              style={{ marginBottom: "15px" }}
              autoFocus
            />
            <button
              className="btn-primary full-width"
              onClick={handleEnterPallet}
            >
              Open to Scan
            </button>
          </div>

          <div
            className="card-box"
            style={{
              padding: "30px 20px",
              background: "#f8fafc",
              border: "2px dashed #cbd5e1",
            }}
          >
            <h3
              style={{
                marginBottom: "10px",
                color: "var(--text-main, #0f172a)",
              }}
            >
              📦 Find Pallet
            </h3>
            <p
              className="text-muted"
              style={{ fontSize: "14px", marginBottom: "20px" }}
            >
              Scan carton to check its Pallet
            </p>
            <form
              onSubmit={handleFindCartonSubmit}
              style={{ position: "relative" }}
            >
              <input
                type="text"
                className="modal-input"
                placeholder="Scan/Type Barcode..."
                value={searchCartonInput}
                onChange={(e) => setSearchCartonInput(e.target.value)}
                style={{ paddingRight: "50px", marginBottom: "15px" }}
              />
              <button
                type="button"
                className="btn-text"
                onClick={() => setCameraMode("dispatch-find")}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "12px",
                  fontSize: "20px",
                  padding: "0",
                }}
              >
                📷
              </button>
              <button type="submit" className="btn-secondary full-width">
                🔍 Search Carton
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Dispatch Scan Screen
  if (step === "dispatch-scan") {
    const totalCartons = activePallet?.ExpectedCartons
      ? activePallet.ExpectedCartons.length
      : 0;
    const acceptedCartons = activePallet?.AcceptedCartons
      ? activePallet.AcceptedCartons.length
      : 0;
    const pendingCartons = totalCartons - acceptedCartons;

    return (
      <div className="screen-container bg-light text-center">
        {cameraMode === "dispatch-scan" && (
          <BarcodeScanner
            onScan={(code) => processCartonScan(code)}
            onClose={() => setCameraMode(null)}
          />
        )}

        {/* 🚀 SUCCESS NOTIFICATION (FLOATING TOP) */}
        {alertModal.isOpen && alertModal.type !== "error" && (
          <div
            style={{
              position: "fixed",
              top: "20px",
              left: "0",
              right: "0",
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 10000,
            }}
          >
            <div
              style={{
                background: "var(--success-color, #10b981)",
                color: "white",
                padding: "10px 20px",
                borderRadius: "30px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
                fontWeight: "bold",
                fontSize: "15px",
              }}
            >
              {alertModal.message}
            </div>
          </div>
        )}

        {/* 🛑 ERROR MODAL (NEEDS OK BUTTON) */}
        {alertModal.isOpen && alertModal.type === "error" && (
          <div
            className="modal-overlay"
            style={{ zIndex: 9999 }}
            onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
          >
            <div className="modal-card text-center">
              <h3 style={{ color: "var(--danger-color, #ef4444)" }}>
                ⚠️ Alert
              </h3>
              <p
                style={{
                  margin: "15px 0",
                  color: "var(--text-main)",
                  fontSize: "16px",
                  fontWeight: "bold",
                }}
              >
                {alertModal.message}
              </p>
              <button
                className="btn-danger full-width mt-3"
                onClick={() =>
                  setAlertModal({ isOpen: false, message: "", type: "info" })
                }
              >
                OK
              </button>
            </div>
          </div>
        )}

        {dispatchDetailsModal.isOpen && (
          <div className="modal-overlay" style={{ zIndex: 10000 }}>
            <div className="modal-card" style={{ maxWidth: "450px" }}>
              <h3
                style={{
                  borderBottom: "1px solid var(--border-color)",
                  paddingBottom: "15px",
                  marginBottom: "15px",
                }}
              >
                {dispatchDetailsModal.title}
              </h3>
              <div
                style={{
                  maxHeight: "300px",
                  overflowY: "auto",
                  textAlign: "left",
                }}
              >
                {dispatchDetailsModal.data.length === 0 ? (
                  <p className="text-muted text-center mt-2">No items found.</p>
                ) : null}
                {dispatchDetailsModal.data.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 10px",
                      borderBottom: "1px solid #f1f5f9",
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
                  setDispatchDetailsModal({
                    isOpen: false,
                    title: "",
                    data: [],
                  })
                }
              >
                Close
              </button>
            </div>
          </div>
        )}

        <div className="top-nav">
          <button
            className="btn-text"
            onClick={() => {
              setActivePallet(null);
              setStep("dispatch-pallet");
            }}
          >
            ⬅ Change
          </button>
          <span className="font-bold">
            {activePallet?.PalletNumber || "Active"}
          </span>
        </div>

        <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
          <div
            className="card-box"
            style={{ padding: "25px", marginBottom: "20px" }}
          >
            <h3 style={{ color: "var(--primary-color)", margin: "0 0 15px 0" }}>
              {activePallet?.StoreName}
            </h3>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                background: "#f8fafc",
                padding: "15px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
                marginBottom: "20px",
              }}
            >
              <div
                style={{ textAlign: "center", flex: 1, cursor: "pointer" }}
                onClick={() => openDispatchDetails("Total")}
              >
                <h2 style={{ margin: 0, color: "var(--text-main)" }}>
                  {totalCartons}
                </h2>
                <small
                  style={{
                    color: "var(--text-muted)",
                    fontWeight: "bold",
                    fontSize: "12px",
                  }}
                >
                  📦 Total
                </small>
              </div>
              <div
                style={{ width: "1px", background: "var(--border-color)" }}
              ></div>
              <div
                style={{ textAlign: "center", flex: 1, cursor: "pointer" }}
                onClick={() => openDispatchDetails("Scanned")}
              >
                <h2
                  style={{ margin: 0, color: "var(--success-color, #10b981)" }}
                >
                  {acceptedCartons}
                </h2>
                <small
                  style={{
                    color: "var(--success-color, #10b981)",
                    fontWeight: "bold",
                    fontSize: "12px",
                  }}
                >
                  ✅ Scanned
                </small>
              </div>
              <div
                style={{ width: "1px", background: "var(--border-color)" }}
              ></div>
              <div
                style={{ textAlign: "center", flex: 1, cursor: "pointer" }}
                onClick={() => openDispatchDetails("Pending")}
              >
                <h2
                  style={{ margin: 0, color: "var(--warning-color, #f59e0b)" }}
                >
                  {pendingCartons}
                </h2>
                <small
                  style={{
                    color: "var(--warning-color, #f59e0b)",
                    fontWeight: "bold",
                    fontSize: "12px",
                  }}
                >
                  ⏳ Pending
                </small>
              </div>
            </div>

            <form onSubmit={handleScanSubmit} style={{ position: "relative" }}>
              <input
                type="text"
                ref={scanInputRef}
                className="modal-input"
                placeholder="Scan Box Barcode here..."
                value={cartonScanInput}
                onChange={(e) => setCartonScanInput(e.target.value)}
                style={{ marginBottom: "15px", paddingRight: "50px" }}
                autoFocus
              />
              <button
                type="button"
                className="btn-text"
                onClick={() => {
                  if (scanInputRef.current) scanInputRef.current.blur();
                  setCameraMode("dispatch-scan");
                }}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "12px",
                  fontSize: "20px",
                  padding: "0",
                }}
              >
                📷
              </button>
              <button type="submit" className="btn-primary full-width">
                Scan (Enter)
              </button>
            </form>
          </div>

          <div
            className="card-box"
            style={{ padding: "20px", textAlign: "left" }}
          >
            <h4
              style={{
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "10px",
                color: "var(--success-color, #10b981)",
                margin: "0",
              }}
            >
              ✅ Accepted Scans List
            </h4>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                marginTop: "15px",
              }}
            >
              {activePallet?.AcceptedCartons.length === 0 && (
                <p className="text-muted" style={{ fontSize: "14px" }}>
                  No boxes verified yet.
                </p>
              )}
              {activePallet?.AcceptedCartons.map((b) => (
                <span
                  key={b}
                  style={{
                    background: "#dcfce7",
                    color: "#166534",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "500",
                  }}
                >
                  📦 {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default DispatchModule;
