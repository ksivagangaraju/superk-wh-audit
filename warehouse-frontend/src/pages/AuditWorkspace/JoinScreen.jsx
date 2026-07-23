import React from "react";

const JoinScreen = ({
  userName,
  setUserName,
  inputSessionId,
  setInputSessionId,
  handleJoinSession,
  setShowInstructions,
  alertModal,
  setAlertModal,
  renderInstructions,
}) => {
  return (
    <div
      className="screen-container bg-light text-center"
      style={{ justifyContent: "center", alignItems: "center" }}
    >
      {alertModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-card text-center">
            <h3
              style={{
                color:
                  alertModal.type === "error"
                    ? "var(--danger-color, #ef4444)"
                    : "var(--primary-color, #3b82f6)",
              }}
            >
              {alertModal.type === "error" ? "⚠️ Error" : "ℹ️ Notification"}
            </h3>
            <p
              style={{
                margin: "15px 0",
                color: "var(--text-muted, #475569)",
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

      <div
        className="card-box"
        style={{ maxWidth: "400px", width: "100%", padding: "40px 20px" }}
      >
        <h2>👷 User Access</h2>
        <p className="text-muted mt-2">Enter your Name and Team ID</p>
        <div style={{ marginTop: "25px" }}>
          <input
            type="text"
            placeholder="Your Full Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="modal-input"
            style={{ marginBottom: "15px" }}
          />
          <input
            type="text"
            placeholder="Team ID (min 6 chars)"
            value={inputSessionId}
            onChange={(e) => setInputSessionId(e.target.value)}
            className="modal-input mb-2"
            style={{ marginBottom: "20px" }}
          />
          <button
            className="btn-primary full-width"
            onClick={handleJoinSession}
          >
            Connect
          </button>
        </div>
      </div>

      <button className="fab-button" onClick={() => setShowInstructions(true)}>
        ?
      </button>
    </div>
  );
};

export default JoinScreen;
