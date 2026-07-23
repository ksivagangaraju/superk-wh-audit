import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

// Ikkada manam divide chesina files ni import chesthunnam
import JoinScreen from "./JoinScreen";
import ModuleSelectScreen from "./ModuleSelectScreen";
import DispatchModule from "./DispatchModule";
import InventoryModule from "./InventoryModule";

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
  const [userName, setUserName] = useState(
    localStorage.getItem("userName") || "",
  );
  const [inputSessionId, setInputSessionId] = useState("");
  const [step, setStep] = useState(sessionId ? "module-select" : "join");
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: "",
    type: "info",
  });
  const [showInstructions, setShowInstructions] = useState(false);

  // --- INVENTORY STATES ---
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

  // --- CAMERA STATE ---
  const [cameraMode, setCameraMode] = useState(null);

  // --- DISPATCH STATES ---
  const [dispatchData, setDispatchData] = useState([]);
  const [isDispatchRunning, setIsDispatchRunning] = useState(false);
  const [currentPalletInput, setCurrentPalletInput] = useState("");
  const [searchCartonInput, setSearchCartonInput] = useState("");
  const [activePallet, setActivePallet] = useState(null);
  const [cartonScanInput, setCartonScanInput] = useState("");
  const scanInputRef = useRef(null);
  const [dispatchDetailsModal, setDispatchDetailsModal] = useState({
    isOpen: false,
    title: "",
    data: [],
  });

  // --- HELPER FUNCTIONS ---
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

      setZones(data.zones || []);
      setCompletedZones(data.completedZones || []);
      setUnlockedZones(data.unlockedZones || []);
      setCompletedLocations(data.completedLocations || []);
      setUnlockedLocations(data.unlockedLocations || []);
      setIsAuditRunning(data.isAuditRunning || false);
      setDispatchData(data.dispatchData || []);
      setIsDispatchRunning(data.isDispatchRunning || false);

      if (data.masterData)
        setAllProducts(
          data.masterData.map((item) => ({
            ...item,
            barcodePhase: item.barcodePhase || 0,
          })),
        );
      if (activePallet && data.dispatchData) {
        const updatedPallet = data.dispatchData.find(
          (p) => p.PalletNumber === activePallet.PalletNumber,
        );
        if (updatedPallet) setActivePallet(updatedPallet);
      }
      if (step === "join" || step === "waiting") setStep("module-select");
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
    socket.on("dispatch-state-changed", (status) =>
      setIsDispatchRunning(status),
    );
    socket.on("data-uploaded", () => fetchSessionData());

    socket.on("dispatch-data-updated", (dData) => {
      setDispatchData(dData);
      if (activePallet) {
        const updatedPallet = dData.find(
          (p) => p.PalletNumber === activePallet.PalletNumber,
        );
        if (updatedPallet) setActivePallet(updatedPallet);
        else {
          setActivePallet(null);
          setStep("dispatch-pallet");
          showAlert(
            "Admin updated Dispatch list. Please re-enter Pallet Number.",
            "info",
          );
        }
      }
    });

    socket.on("dispatch-scan-result", (res) => {
      showAlert(res.message, res.success ? "info" : "error");
      setCartonScanInput("");
    });

    socket.on("session-cleared", () => {
      showAlert("Admin has logged out.", "info");
      handleExitSession();
    });

    return () => {
      socket.off("zone-status-changed");
      socket.off("location-status-changed");
      socket.off("audit-state-changed");
      socket.off("dispatch-state-changed");
      socket.off("data-uploaded");
      socket.off("dispatch-data-updated");
      socket.off("dispatch-scan-result");
      socket.off("session-cleared");
    };
  }, [sessionId, activePallet]);

  // --- ACTIONS ---
  const handleJoinSession = () => {
    if (inputSessionId.trim().length >= 6 && userName.trim() !== "") {
      localStorage.setItem("userName", userName.trim());
      setSessionId(inputSessionId.trim());
    } else
      showAlert("Please enter your Name AND a Team ID (min 6 chars).", "error");
  };

  const handleExitSession = () => {
    if (sessionId) socket.emit("leave-session", sessionId);
    setSessionId("");
    localStorage.removeItem("userSessionId");
    localStorage.removeItem("userName");
    setStep("join");
  };

  // --- DISPATCH FUNCTIONS ---
  const handleEnterPallet = () => {
    const input = currentPalletInput.trim().toLowerCase();
    const pallet = dispatchData.find(
      (p) =>
        (p.PalletNumber && p.PalletNumber.toLowerCase() === input) ||
        (p.StoreName && p.StoreName.toLowerCase() === input),
    );
    if (pallet) {
      setActivePallet(pallet);
      setStep("dispatch-scan");
    } else
      showAlert(
        "Pallet/Store Not Found! Please check the name or number.",
        "error",
      );
  };

  const executeFindCarton = (carton) => {
    if (!carton) return;
    let foundStore = null;
    for (let store of dispatchData) {
      if (store.ExpectedCartons.includes(carton)) {
        foundStore = store;
        break;
      }
    }
    if (foundStore)
      showAlert(
        `📦 Carton: ${carton}\n🏢 Store: ${foundStore.StoreName}\n📍 Pallet: ${foundStore.PalletNumber || "Not Assigned"}`,
        "info",
      );
    else
      showAlert(
        `Carton ${carton} not found in today's Dispatch list!`,
        "error",
      );
    setSearchCartonInput("");
  };

  const handleFindCartonSubmit = (e) => {
    e.preventDefault();
    executeFindCarton(searchCartonInput.trim());
  };

  const processCartonScan = (code) => {
    const trimmedCode = code.trim();
    if (!trimmedCode) return;
    if (activePallet && activePallet.AcceptedCartons.includes(trimmedCode)) {
      const scannedByWhom =
        activePallet.ScannedBy && activePallet.ScannedBy[trimmedCode]
          ? activePallet.ScannedBy[trimmedCode].user
          : "another user";
      showAlert(
        `⚠️ Carton ${trimmedCode} was already scanned by ${scannedByWhom}!`,
        "error",
      );
      setCartonScanInput("");
      return;
    }
    setCartonScanInput(trimmedCode);
    socket.emit("verify-dispatch-carton", {
      sessionId,
      currentPallet: activePallet.PalletNumber,
      cartonNumber: trimmedCode,
      userName,
    });
  };

  const handleScanSubmit = (e) => {
    e.preventDefault();
    if (scanInputRef.current) scanInputRef.current.blur();
    processCartonScan(cartonScanInput);
  };

  const openDispatchDetails = (type) => {
    if (!activePallet) return;
    let dataToShow = [];
    if (type === "Pending") {
      const pendingBoxes = activePallet.ExpectedCartons.filter(
        (c) => !activePallet.AcceptedCartons.includes(c),
      );
      dataToShow = pendingBoxes.map((b) => ({
        carton: b,
        details: "⏳ Not scanned yet",
      }));
    } else if (type === "Scanned") {
      dataToShow = activePallet.AcceptedCartons.map((b) => ({
        carton: b,
        details: "✅ Verified",
      }));
    } else if (type === "Total") {
      dataToShow = activePallet.ExpectedCartons.map((b) => ({
        carton: b,
        details: activePallet.AcceptedCartons.includes(b)
          ? "✅ Verified"
          : "⏳ Pending",
      }));
    }
    setDispatchDetailsModal({
      isOpen: true,
      title: `${activePallet.StoreName} (${type})`,
      data: dataToShow,
    });
  };

  // --- INVENTORY FUNCTIONS ---
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
        const updatedItem = {
          ...p,
          [field]: value,
          AuditedBy: userName,
          ...extraFields,
        };
        socket.emit("update-item", { sessionId, updatedItem });
        return updatedItem;
      }
      return p;
    });
    setFilteredProducts(updatedFiltered);
    const updatedAll = allProducts.map((p) =>
      p.uid === uid
        ? { ...p, [field]: value, AuditedBy: userName, ...extraFields }
        : p,
    );
    setAllProducts(updatedAll);
  };

  const saveModalData = () => {
    const currentItem = filteredProducts[currentIndex];
    let extra = modal.field === "ActualBarcode" ? { barcodePhase: 2 } : {};
    updateProductState(currentItem.uid, modal.field, modal.value, extra);
    setModal({ ...modal, isOpen: false });
  };

  const changeBarcodePhaseState = (phaseNum) =>
    updateProductState(
      filteredProducts[currentIndex].uid,
      "barcodePhase",
      phaseNum,
    );
  const resetManualBarcode = () =>
    updateProductState(
      filteredProducts[currentIndex].uid,
      "ActualBarcode",
      "",
      { barcodePhase: 0 },
    );
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
    socket.emit("mark-location-complete", {
      sessionId,
      locationKey: `${selectedZone}___${selectedLocation}`,
    });
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

  // --- INSTRUCTIONS UI ---
  const renderInstructions = () =>
    showInstructions && (
      <div className="modal-overlay" style={{ zIndex: 9999 }}>
        <div className="modal-card">
          <h3 style={{ color: "var(--primary-color)", textAlign: "center" }}>
            📖 User Guide
          </h3>
          <div className="instructions-content" style={{ marginTop: "15px" }}>
            <h4>📦 Inventory Audit:</h4>
            <ul
              style={{
                paddingLeft: "20px",
                marginBottom: "15px",
                color: "var(--text-muted)",
              }}
            >
              <li>
                Select your assigned <b>Zone</b> and <b>Location</b>.
              </li>
              <li>Check physical stock against screen data.</li>
              <li>
                <b>Swipe Left</b> ⬅️ if details exactly match.
              </li>
              <li>
                <b>Tap on Boxes</b> to edit differences.
              </li>
            </ul>
            <h4>🚚 Dispatch Verify:</h4>
            <ul style={{ paddingLeft: "20px", color: "var(--text-muted)" }}>
              <li>
                Enter your assigned <b>Pallet Number</b> or Store Name.
              </li>
              <li>Scan carton barcodes to verify them against the pallet.</li>
            </ul>
          </div>
          <button
            className="btn-primary full-width mt-2"
            onClick={() => setShowInstructions(false)}
          >
            I Understand
          </button>
        </div>
      </div>
    );

  // ==========================================
  // 🚀 MAIN RENDER LOGIC (CLEAN ARCHITECTURE)
  // ==========================================

  return (
    <div className="app-container">
      {step === "join" && (
        <JoinScreen
          userName={userName}
          setUserName={setUserName}
          inputSessionId={inputSessionId}
          setInputSessionId={setInputSessionId}
          handleJoinSession={handleJoinSession}
          setShowInstructions={setShowInstructions}
          alertModal={alertModal}
          setAlertModal={setAlertModal}
          renderInstructions={renderInstructions}
        />
      )}

      {step === "module-select" && (
        <ModuleSelectScreen
          sessionId={sessionId}
          handleExitSession={handleExitSession}
          allProducts={allProducts}
          dispatchData={dispatchData}
          setStep={setStep}
          showAlert={showAlert}
          setShowInstructions={setShowInstructions}
          renderInstructions={renderInstructions}
        />
      )}

      {step === "waiting" && (
        <div
          className="screen-container bg-light text-center"
          style={{ justifyContent: "center", position: "relative" }}
        >
          <div className="top-nav">
            <span className="font-bold">
              Team ID:{" "}
              <span style={{ color: "var(--primary-color)" }}>{sessionId}</span>
            </span>
            <button className="btn-text danger" onClick={handleExitSession}>
              Exit
            </button>
          </div>
          {renderInstructions()}
          <div
            className="card-box"
            style={{ margin: "auto", maxWidth: "400px" }}
          >
            <h1 style={{ fontSize: "60px", margin: "0" }}>⏳</h1>
            <h2 style={{ color: "var(--primary-color)", marginTop: "20px" }}>
              Waiting for Admin
            </h2>
            <p className="text-muted mt-2">
              Master Excel File hasn't been uploaded yet.
            </p>
            <button
              className="btn-secondary full-width mt-2"
              onClick={() => setStep("module-select")}
            >
              ⬅ Back to Menu
            </button>
          </div>
        </div>
      )}

      {step.startsWith("dispatch") && (
        <DispatchModule
          step={step}
          setStep={setStep}
          sessionId={sessionId}
          handleExitSession={handleExitSession}
          renderInstructions={renderInstructions}
          isDispatchRunning={isDispatchRunning}
          dispatchData={dispatchData}
          cameraMode={cameraMode}
          setCameraMode={setCameraMode}
          executeFindCarton={executeFindCarton}
          alertModal={alertModal}
          setAlertModal={setAlertModal}
          activePallet={activePallet}
          setActivePallet={setActivePallet}
          currentPalletInput={currentPalletInput}
          setCurrentPalletInput={setCurrentPalletInput}
          handleEnterPallet={handleEnterPallet}
          searchCartonInput={searchCartonInput}
          setSearchCartonInput={setSearchCartonInput}
          handleFindCartonSubmit={handleFindCartonSubmit}
          processCartonScan={processCartonScan}
          dispatchDetailsModal={dispatchDetailsModal}
          setDispatchDetailsModal={setDispatchDetailsModal}
          openDispatchDetails={openDispatchDetails}
          handleScanSubmit={handleScanSubmit}
          scanInputRef={scanInputRef}
          cartonScanInput={cartonScanInput}
          setCartonScanInput={setCartonScanInput}
        />
      )}

      {["zone-select", "location-select", "audit"].includes(step) && (
        <InventoryModule
          step={step}
          setStep={setStep}
          sessionId={sessionId}
          handleExitSession={handleExitSession}
          renderInstructions={renderInstructions}
          isAuditRunning={isAuditRunning}
          allProducts={allProducts}
          cameraMode={cameraMode}
          setCameraMode={setCameraMode}
          updateProductState={updateProductState}
          filteredProducts={filteredProducts}
          currentIndex={currentIndex}
          alertModal={alertModal}
          setAlertModal={setAlertModal}
          zones={zones}
          completedZones={completedZones}
          unlockedZones={unlockedZones}
          handleZoneSelect={handleZoneSelect}
          getButtonStyle={getButtonStyle}
          selectedZone={selectedZone}
          getLocationsForZone={getLocationsForZone}
          completedLocations={completedLocations}
          unlockedLocations={unlockedLocations}
          handleLocationSelect={handleLocationSelect}
          isZoneCompletionModalOpen={isZoneCompletionModalOpen}
          setIsZoneCompletionModalOpen={setIsZoneCompletionModalOpen}
          confirmZoneCompletion={confirmZoneCompletion}
          modal={modal}
          setModal={setModal}
          saveModalData={saveModalData}
          isCompletionModalOpen={isCompletionModalOpen}
          confirmLocationCompletion={confirmLocationCompletion}
          setIsCompletionModalOpen={setIsCompletionModalOpen}
          isFlagConfirmModalOpen={isFlagConfirmModalOpen}
          setIsFlagConfirmModalOpen={setIsFlagConfirmModalOpen}
          handleAuditAction={handleAuditAction}
          handleDragEnd={handleDragEnd}
          resetManualBarcode={resetManualBarcode}
          changeBarcodePhaseState={changeBarcodePhaseState}
        />
      )}
    </div>
  );
};

export default AuditWorkspace;
