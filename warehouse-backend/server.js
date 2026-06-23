const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// Payload limit increased to 50MB to handle large master files
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const server = http.createServer(app);

// Socket.io for Real-time communication
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// --- IN-MEMORY DATABASE ---
let masterData = [];
let zonesList = [];
let completedZones = [];
let isAuditRunning = false; // Global state to Start/Hold audit
// --------------------------

// 1. SET MASTER DATA (Frontend sends parsed JSON here)
app.post("/api/set-data", (req, res) => {
  const { data, zones } = req.body;
  masterData = data;
  zonesList = zones;
  completedZones = [];
  isAuditRunning = false; // Reset to hold on new upload

  // Notify all connected clients that new data is available
  io.emit("data-updated", {
    zones: zonesList,
    completedZones,
    masterData,
    isAuditRunning,
  });
  res.status(200).send("Data stored successfully.");
});

// 2. GET INITIAL DATA (Users/Admin call this when they load the app)
app.get("/api/status", (req, res) => {
  res.json({
    zones: zonesList,
    completedZones,
    masterData,
    isAuditRunning,
    totalItems: masterData.length,
  });
});

// --- SOCKET.IO LIVE TRACKING LOGIC ---
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Send current status immediately to the newly connected user
  socket.emit("initial-status", {
    zones: zonesList,
    completedZones,
    masterData,
    isAuditRunning,
  });

  // ADMIN ACTION: Toggle Audit State (Start / Hold)
  socket.on("toggle-audit-state", (status) => {
    isAuditRunning = status;
    console.log(`Audit is now ${status ? "RUNNING" : "ON HOLD"}`);
    io.emit("audit-state-changed", isAuditRunning);
  });

  // USER ACTION: Auto-Save individual item edit/swipe
  socket.on("update-item", (updatedItem) => {
    const index = masterData.findIndex((p) => p.uid === updatedItem.uid);
    if (index !== -1) {
      masterData[index] = updatedItem; // Update backend memory instantly
    }
  });

  // USER ACTION: Mark Zone as Complete
  socket.on("mark-zone-complete", (zoneName) => {
    if (!completedZones.includes(zoneName)) {
      completedZones.push(zoneName);
      console.log(`Zone ${zoneName} marked as Complete.`);
      io.emit("zone-status-changed", { completedZones });
    }
  });

  // ADMIN ACTION: Unlock/Reopen a Zone for corrections
  socket.on("unlock-zone", (zoneName) => {
    completedZones = completedZones.filter((z) => z !== zoneName);
    console.log(`Zone ${zoneName} Unlocked by Admin.`);
    io.emit("zone-status-changed", { completedZones });
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`✅ Warehouse Backend Server running on port ${PORT}`);
});
