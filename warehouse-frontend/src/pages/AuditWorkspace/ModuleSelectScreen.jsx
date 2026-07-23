import React from "react";

const ModuleSelectScreen = ({
  sessionId,
  handleExitSession,
  allProducts,
  dispatchData,
  setStep,
  showAlert,
  setShowInstructions,
  renderInstructions,
}) => {
  return (
    <div className="screen-container bg-light text-center">
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
      {renderInstructions()}

      <div
        style={{
          padding: "20px",
          marginTop: "30px",
          maxWidth: "600px",
          margin: "30px auto 0",
        }}
      >
        <h2>Select Work Module</h2>
        <p className="text-muted mt-2">Choose a task to begin your audit</p>

        <div
          className="card-box mt-5"
          style={{
            cursor: "pointer",
            transition: "transform 0.2s",
            padding: "25px",
          }}
          onClick={() => {
            if (allProducts.length === 0) setStep("waiting");
            else setStep("zone-select");
          }}
        >
          <h3 style={{ fontSize: "20px" }}>📦 Inventory Audit</h3>
          <p className="text-muted mt-2">Verify physical stock in zones.</p>
        </div>

        <div
          className="card-box mt-4"
          style={{
            cursor: "pointer",
            transition: "transform 0.2s",
            padding: "25px",
          }}
          onClick={() => {
            if (dispatchData.length === 0)
              showAlert("Admin hasn't uploaded Dispatch Data yet.", "error");
            else setStep("dispatch-pallet");
          }}
        >
          <h3 style={{ fontSize: "20px" }}>🚚 Dispatch Verify</h3>
          <p className="text-muted mt-2">Scan cartons to pallets.</p>
        </div>
      </div>

      <button className="fab-button" onClick={() => setShowInstructions(true)}>
        ?
      </button>
    </div>
  );
};

export default ModuleSelectScreen;
