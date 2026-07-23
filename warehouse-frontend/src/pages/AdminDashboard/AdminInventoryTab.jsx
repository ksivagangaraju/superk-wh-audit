import React from "react";

const AdminInventoryTab = (props) => {
  const {
    masterData,
    handleInventoryUpload,
    isAuditRunning,
    socket,
    sessionId,
    selectedZoneAdmin,
    setSelectedZoneAdmin,
    zones,
    completedZones,
    unlockedZones,
    getButtonStyle,
    handleUnlockZone,
    getLocationsForAdminZone,
    completedLocations,
    unlockedLocations,
    handleUnlockLocation,
  } = props;

  if (masterData.length === 0) {
    return (
      <div className="card-box text-center">
        <h3>No Inventory Data</h3>
        <input
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleInventoryUpload}
          id="admin-file"
          style={{ display: "none" }}
        />
        <label
          htmlFor="admin-file"
          className="btn-success full-width mt-2"
          style={{
            display: "inline-block",
            padding: "15px",
            cursor: "pointer",
          }}
        >
          📤 Upload Inventory Excel
        </label>
      </div>
    );
  }

  return (
    <>
      <div
        className="card-box text-center"
        style={{ padding: "15px", marginBottom: "20px" }}
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
              color: isAuditRunning ? "#059669" : "#b91c1c",
              margin: 0,
              marginBottom: "10px",
            }}
          >
            {isAuditRunning ? "🟢 Audit LIVE" : "🛑 Audit ON HOLD"}
          </h2>
          <div>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleInventoryUpload}
              id="reupload-inv"
              style={{ display: "none" }}
            />
            <label
              htmlFor="reupload-inv"
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
              socket.emit("toggle-audit-state", { sessionId, status: true })
            }
            disabled={isAuditRunning}
          >
            ▶ Start
          </button>
          <button
            className="btn-danger"
            onClick={() =>
              socket.emit("toggle-audit-state", { sessionId, status: false })
            }
            disabled={!isAuditRunning}
          >
            ⏸ Hold
          </button>
          <button
            className="btn-danger"
            style={{ background: "#94a3b8" }}
            onClick={() => {
              if (
                window.confirm(
                  "Are you sure you want to clear ALL Inventory Data?",
                )
              ) {
                socket.emit("clear-inventory-data", sessionId);
              }
            }}
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      <div className="card-box">
        {!selectedZoneAdmin ? (
          <>
            <h3 style={{ marginBottom: "20px" }}>Monitor Zones</h3>
            <div className="zone-grid" style={{ maxWidth: "100%", padding: 0 }}>
              {zones.map((zone) => {
                const isDone = completedZones.includes(zone);
                const isUnlocked = unlockedZones.includes(zone);
                return (
                  <div
                    key={zone}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                    }}
                  >
                    <button
                      className="btn-zone"
                      onClick={() => setSelectedZoneAdmin(zone)}
                      style={{ ...getButtonStyle(isDone, isUnlocked) }}
                    >
                      {zone} <br />
                      <span style={{ fontSize: "13px", fontWeight: "normal" }}>
                        {isDone
                          ? "✅ Locked"
                          : isUnlocked
                            ? "🔄 Correction"
                            : "⏳ Active"}
                      </span>
                    </button>
                    {isDone && (
                      <button
                        className="btn-text sm danger"
                        onClick={() => handleUnlockZone(zone)}
                      >
                        🔓 Unlock Zone
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <button
                className="btn-text"
                onClick={() => setSelectedZoneAdmin("")}
              >
                ⬅ Back to Zones
              </button>
              <h3 style={{ margin: 0 }}>Zone: {selectedZoneAdmin}</h3>
            </div>
            <div className="zone-grid" style={{ maxWidth: "100%", padding: 0 }}>
              {getLocationsForAdminZone().map((loc) => {
                const locKey = `${selectedZoneAdmin}___${loc}`;
                const isDone = completedLocations.includes(locKey);
                const isUnlocked = unlockedLocations.includes(locKey);
                return (
                  <div
                    key={locKey}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                    }}
                  >
                    <button
                      className="btn-zone"
                      disabled={true}
                      style={{ ...getButtonStyle(isDone, isUnlocked) }}
                    >
                      <b>{loc}</b> <br />
                      <span style={{ fontSize: "13px", fontWeight: "normal" }}>
                        {isDone
                          ? "✅ Locked"
                          : isUnlocked
                            ? "🔄 Correction"
                            : "⏳ Active"}
                      </span>
                    </button>
                    {isDone && (
                      <button
                        className="btn-text sm danger"
                        onClick={() => handleUnlockLocation(locKey)}
                      >
                        🔓 Unlock
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default AdminInventoryTab;
