import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import io from "socket.io-client";
import BarcodeScanner from "../components/BarcodeScanner";

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

  // INVENTORY
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

  // 🚀 Camera State
  const [cameraMode, setCameraMode] = useState(null); // 'inventory' | 'dispatch-find' | 'dispatch-scan' | null

  // DISPATCH
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

  const handleJoinSession = () => {
    if (inputSessionId.trim().length >= 6 && userName.trim() !== "") {
      localStorage.setItem("userName", userName.trim());
      setSessionId(inputSessionId.trim());
    } else {
      showAlert("Please enter your Name AND a Team ID (min 6 chars).", "error");
    }
  };

  const handleExitSession = () => {
    if (sessionId) socket.emit("leave-session", sessionId);
    setSessionId("");
    localStorage.removeItem("userSessionId");
    localStorage.removeItem("userName");
    setStep("join");
  };

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
    } else {
      showAlert(
        "Pallet/Store Not Found! Please check the name or number.",
        "error",
      );
    }
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

  // 🚀 KOTHA: Scan ni process mariyu Duplicate check chese function
  const processCartonScan = (code) => {
    const trimmedCode = code.trim();
    if (!trimmedCode) return;

    // 1. Box already scan ayyinda ledha ani check chesthundi
    if (activePallet && activePallet.AcceptedCartons.includes(trimmedCode)) {
      // 2. Evaru scan chesaro vethukuthundi (Admin format nunchi)
      const scannedByWhom =
        activePallet.ScannedBy && activePallet.ScannedBy[trimmedCode]
          ? activePallet.ScannedBy[trimmedCode].user
          : "another user";

      // 3. Error chupinchi, text box clear chesthundi
      showAlert(
        `⚠️ Carton ${trimmedCode} was already scanned by ${scannedByWhom}!`,
        "error",
      );
      setCartonScanInput("");
      return; // Backend ki vellakunda ikkade aagipothundi
    }

    // Okavela kotha box ayithe backend ki pamputhundi
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

    // 🚀 TYPING FIX: Type chesi Enter (Scan) kottagane keyboard close aipothundi
    if (scanInputRef.current) {
      scanInputRef.current.blur();
    }

    // Typing data ni process function ki pamputhundi
    processCartonScan(cartonScanInput);
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

  const renderInstructions = () =>
    showInstructions && (
      <div className="modal-overlay" style={{ zIndex: 9999 }}>
        <div className="modal-card">
          <h3 style={{ color: "#3b82f6", textAlign: "center" }}>
            📖 User Guide
          </h3>
          <div className="instructions-content">
            <h4>📦 Inventory Audit:</h4>
            <ul>
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
            <ul>
              <li>
                Enter your assigned <b>Pallet Number</b> or Store Name.
              </li>
              <li>Scan carton barcodes to verify them against the pallet.</li>
            </ul>
          </div>
          <button
            className="btn-primary full-width"
            onClick={() => setShowInstructions(false)}
          >
            I Understand
          </button>
        </div>
      </div>
    );

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
                style={{
                  margin: "15px 0",
                  color: "#475569",
                  fontSize: "15px",
                  whiteSpace: "pre-line",
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
        <div className="card-box" style={{ margin: "0" }}>
          <h2>👷 User Access</h2>
          <p className="text-muted mt-2">Enter your Name and Team ID</p>
          <input
            type="text"
            placeholder="Your Full Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="modal-input"
            style={{ marginBottom: "2px" }}
          />
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
            Connect
          </button>
        </div>
        <button
          className="fab-button"
          onClick={() => setShowInstructions(true)}
        >
          ?
        </button>
      </div>
    );
  }

  if (step === "module-select") {
    return (
      <div className="screen-container bg-light text-center">
        <div className="top-nav">
          <span className="font-bold">Team ID: {sessionId}</span>
          <button className="btn-text danger" onClick={handleExitSession}>
            Exit
          </button>
        </div>
        {renderInstructions()}
        <div style={{ padding: "20px", marginTop: "30px" }}>
          <h2>Select Work Module</h2>
          <div
            className="module-select-card mt-5"
            onClick={() => {
              if (allProducts.length === 0) setStep("waiting");
              else setStep("zone-select");
            }}
          >
            <h3>📦 Inventory Audit</h3>
            <p className="text-muted">Verify physical stock in zones.</p>
          </div>
          <div
            className="module-select-card"
            onClick={() => {
              if (dispatchData.length === 0)
                showAlert("Admin hasn't uploaded Dispatch Data yet.", "error");
              else setStep("dispatch-pallet");
            }}
          >
            <h3>🚚 Dispatch Verify</h3>
            <p className="text-muted">Scan cartons to pallets.</p>
          </div>
        </div>
        <button
          className="fab-button"
          onClick={() => setShowInstructions(true)}
        >
          ?
        </button>
      </div>
    );
  }

  if (
    !isDispatchRunning &&
    dispatchData.length > 0 &&
    step.startsWith("dispatch")
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
        <h1 style={{ fontSize: "60px", margin: "0" }}>⏸</h1>
        <h2 style={{ color: "#fca5a5", marginTop: "20px" }}>
          Dispatch on Hold
        </h2>
        <p className="text-muted">Admin has paused the dispatch scan...</p>
        <button
          className="btn-secondary"
          onClick={() => {
            setActivePallet(null);
            setStep("module-select");
          }}
          style={{ marginTop: "20px" }}
        >
          ⬅ Back to Menu
        </button>
      </div>
    );
  }

  if (step === "dispatch-pallet") {
    return (
      <div className="screen-container bg-light text-center">
        {/* CAMERA SCANNER MODAL */}
        {cameraMode === "dispatch-find" && (
          <BarcodeScanner
            onScan={(code) => executeFindCarton(code)}
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
                {alertModal.type === "error" ? "⚠️ Notice" : "ℹ️ Info"}
              </h3>
              <p
                style={{
                  margin: "15px 0",
                  color: "#475569",
                  whiteSpace: "pre-line",
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
        <div style={{ padding: "20px" }}>
          <div
            className="card-box"
            style={{ margin: "0 auto 20px auto", padding: "20px" }}
          >
            <h3 style={{ marginBottom: "10px" }}>📍 Open Pallet</h3>
            <p className="text-muted" style={{ fontSize: "13px" }}>
              Enter Pallet No or Store Name
            </p>
            <input
              type="text"
              className="modal-input"
              placeholder="e.g. P-01"
              value={currentPalletInput}
              onChange={(e) => setCurrentPalletInput(e.target.value)}
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
              margin: "0 auto",
              padding: "20px",
              background: "#f8fafc",
              border: "2px dashed #cbd5e1",
            }}
          >
            <h3 style={{ marginBottom: "10px", color: "#475569" }}>
              📦 Find Pallet
            </h3>
            <p className="text-muted" style={{ fontSize: "13px" }}>
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
                style={{ paddingRight: "40px" }}
              />
              {/* 🚀 Camera Button inside Input */}
              <button
                type="button"
                className="btn-text"
                onClick={() => setCameraMode("dispatch-find")}
                style={{
                  position: "absolute",
                  right: "5px",
                  top: "10px",
                  fontSize: "20px",
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
        <button
          className="fab-button"
          onClick={() => setShowInstructions(true)}
        >
          ?
        </button>
      </div>
    );
  }

  if (step === "dispatch-scan") {
    const totalCartons = activePallet.ExpectedCartons
      ? activePallet.ExpectedCartons.length
      : 0;
    const acceptedCartons = activePallet.AcceptedCartons
      ? activePallet.AcceptedCartons.length
      : 0;
    const pendingCartons = totalCartons - acceptedCartons;

    return (
      <div className="screen-container bg-gray text-center">
        {/* CAMERA SCANNER MODAL */}
        {cameraMode === "dispatch-scan" && (
          <BarcodeScanner
            onScan={(code) => processCartonScan(code)}
            onClose={() => setCameraMode(null)}
          />
        )}

        {/* 🚀 DISPATCH DETAILS MODAL (CLICK CHESTHE VASTHUNDI) */}
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
              <div
                style={{
                  maxHeight: "300px",
                  overflowY: "auto",
                  textAlign: "left",
                }}
              >
                {dispatchDetailsModal.data.length === 0 ? (
                  <p className="text-muted text-center">No items found.</p>
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

        {alertModal.isOpen && (
          <div
            className="modal-overlay"
            style={{ zIndex: 9999 }}
            onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
          >
            <div className="modal-card text-center">
              <h3
                style={{
                  color: alertModal.type === "error" ? "#ef4444" : "#10b981",
                }}
              >
                {alertModal.type === "error" ? "⚠️ Alert" : "✅ Success"}
              </h3>
              <p
                style={{
                  margin: "15px 0",
                  color: "#475569",
                  fontSize: "16px",
                  fontWeight: "bold",
                }}
              >
                {alertModal.message}
              </p>
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
            ⬅ Change Pallet
          </button>
          <span className="font-bold">
            {activePallet.PalletNumber || "Active"}
          </span>
        </div>

        <div style={{ padding: "20px" }}>
          <div
            className="card-box"
            style={{
              padding: "20px",
              marginBottom: "15px",
              width: "100%",
              maxWidth: "100%",
            }}
          >
            <h3 style={{ color: "#3b82f6", margin: "0 0 10px 0" }}>
              {activePallet.StoreName}
            </h3>

            {/* 🚀 STATS TRACKER UI WITH CLICK EVENTS */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                background: "#f8fafc",
                padding: "15px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                marginBottom: "15px",
              }}
            >
              <div
                style={{ textAlign: "center", flex: 1, cursor: "pointer" }}
                onClick={() => openDispatchDetails("Total")}
              >
                <h2 style={{ margin: 0, color: "#334155" }}>{totalCartons}</h2>
                <small
                  style={{
                    color: "#64748b",
                    fontWeight: "bold",
                    fontSize: "12px",
                  }}
                >
                  📦 Total
                </small>
              </div>
              <div style={{ width: "1px", background: "#cbd5e1" }}></div>
              <div
                style={{ textAlign: "center", flex: 1, cursor: "pointer" }}
                onClick={() => openDispatchDetails("Scanned")}
              >
                <h2 style={{ margin: 0, color: "#10b981" }}>
                  {acceptedCartons}
                </h2>
                <small
                  style={{
                    color: "#10b981",
                    fontWeight: "bold",
                    fontSize: "12px",
                  }}
                >
                  ✅ Scanned
                </small>
              </div>
              <div style={{ width: "1px", background: "#cbd5e1" }}></div>
              <div
                style={{ textAlign: "center", flex: 1, cursor: "pointer" }}
                onClick={() => openDispatchDetails("Pending")}
              >
                <h2 style={{ margin: 0, color: "#f59e0b" }}>
                  {pendingCartons}
                </h2>
                <small
                  style={{
                    color: "#f59e0b",
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
                style={{ marginBottom: "10px", paddingRight: "40px" }}
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
                  right: "5px",
                  top: "10px",
                  fontSize: "20px",
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
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "15px",
              textAlign: "left",
            }}
          >
            <h4
              style={{
                borderBottom: "1px solid #ccc",
                paddingBottom: "10px",
                color: "#10b981",
                marginTop: "5px",
              }}
            >
              ✅ Accepted Scans List
            </h4>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                marginTop: "10px",
              }}
            >
              {activePallet.AcceptedCartons.length === 0 && (
                <p className="text-muted" style={{ fontSize: "13px" }}>
                  No boxes verified yet.
                </p>
              )}
              {activePallet.AcceptedCartons.map((b) => (
                <span
                  key={b}
                  style={{
                    background: "#dcfce7",
                    color: "#166534",
                    padding: "5px 10px",
                    borderRadius: "6px",
                    fontSize: "13px",
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
            Exit
          </button>
        </div>
        {renderInstructions()}
        <h1 style={{ fontSize: "60px", margin: "0" }}>⏳</h1>
        <h2 style={{ color: "#fcd34d", marginTop: "20px" }}>
          Waiting for Admin
        </h2>
        <p className="text-muted" style={{ padding: "0 15px" }}>
          Master Excel File hasn't been uploaded yet.
        </p>
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

  // --- RESTORED INVENTORY AUDIT (SWIPE) SCREENS ---
  return (
    <div className="screen-container bg-light" style={{ overflowY: "auto" }}>
      {/* CAMERA SCANNER MODAL */}
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
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <small style={{ margin: 0 }}>Barcode Verification</small>
                      {/* 🚀 Camera Scan Button for Inventory */}
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
      <button className="fab-button" onClick={() => setShowInstructions(true)}>
        ?
      </button>
    </div>
  );
};

export default AuditWorkspace;
