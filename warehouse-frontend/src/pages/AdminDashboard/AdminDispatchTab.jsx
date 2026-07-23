import React from "react";

const AdminDispatchTab = (props) => {
  const {
    dispatchData,
    handleDispatchUpload,
    isDispatchRunning,
    socket,
    sessionId,
    openDispatchDetails,
  } = props;

  if (dispatchData.length === 0) {
    return (
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
    );
  }

  return (
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
            {isDispatchRunning ? "🟢 Dispatch LIVE" : "🛑 Dispatch ON HOLD"}
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
              socket.emit("toggle-dispatch-state", { sessionId, status: true })
            }
            disabled={isDispatchRunning}
          >
            ▶ Start Scan
          </button>
          <button
            className="btn-danger"
            onClick={() =>
              socket.emit("toggle-dispatch-state", { sessionId, status: false })
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
  );
};

export default AdminDispatchTab;
