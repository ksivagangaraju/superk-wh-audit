const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const sessions = {};

app.post("/api/create-session", (req, res) => {
  const { sessionId } = req.body;
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      masterData: [],
      zonesList: [],
      completedZones: [],
      unlockedZones: [],
      completedLocations: [],
      unlockedLocations: [],
      isAuditRunning: false,
    };
  }
  res.status(200).json({ success: true });
});

app.post("/api/set-data", (req, res) => {
  const { data, zones, sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "Session ID required" });

  if (!sessions[sessionId]) sessions[sessionId] = {};

  sessions[sessionId].masterData = data;
  sessions[sessionId].zonesList = zones;
  sessions[sessionId].completedZones = [];
  sessions[sessionId].unlockedZones = [];
  sessions[sessionId].completedLocations = [];
  sessions[sessionId].unlockedLocations = [];
  sessions[sessionId].isAuditRunning = false;

  io.to(sessionId).emit("data-uploaded");

  res.status(200).json({ success: true, sessionId });
});

app.get("/api/status/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = sessions[sessionId];

  if (!session) return res.status(404).json({ error: "Session not found" });

  res.json({
    zones: session.zonesList,
    completedZones: session.completedZones,
    unlockedZones: session.unlockedZones,
    completedLocations: session.completedLocations,
    unlockedLocations: session.unlockedLocations,
    masterData: session.masterData,
    isAuditRunning: session.isAuditRunning,
  });
});

app.post("/api/clear-session", (req, res) => {
  const { sessionId } = req.body;
  if (sessions[sessionId]) {
    io.to(sessionId).emit("session-cleared");
    delete sessions[sessionId];
    res.status(200).send("Session completely deleted");
  } else {
    res.status(404).send("Session not found");
  }
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-session", (sessionId) => {
    // 🚨 STRICT ISOLATION FIX: Leave all other session rooms before joining a new one
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });

    socket.join(sessionId);
    const session = sessions[sessionId];
    if (session) {
      socket.emit("initial-status", {
        zones: session.zonesList,
        completedZones: session.completedZones,
        unlockedZones: session.unlockedZones,
        completedLocations: session.completedLocations,
        unlockedLocations: session.unlockedLocations,
        masterData: session.masterData,
        isAuditRunning: session.isAuditRunning,
      });
    }
  });

  // 🚨 Explicit leave event for when user manually exits
  socket.on("leave-session", (sessionId) => {
    socket.leave(sessionId);
  });

  socket.on("toggle-audit-state", ({ sessionId, status }) => {
    if (sessions[sessionId]) {
      sessions[sessionId].isAuditRunning = status;
      io.to(sessionId).emit("audit-state-changed", status);
    }
  });

  socket.on("update-item", ({ sessionId, updatedItem }) => {
    const session = sessions[sessionId];
    if (session) {
      const index = session.masterData.findIndex(
        (p) => p.uid === updatedItem.uid,
      );
      if (index !== -1) {
        session.masterData[index] = updatedItem;
        io.to(sessionId).emit("item-updated", updatedItem);
      }
    }
  });

  socket.on("mark-location-complete", ({ sessionId, locationKey }) => {
    const session = sessions[sessionId];
    if (session && !session.completedLocations.includes(locationKey)) {
      session.completedLocations.push(locationKey);
      session.unlockedLocations = session.unlockedLocations.filter(
        (loc) => loc !== locationKey,
      );
      io.to(sessionId).emit("location-status-changed", {
        completedLocations: session.completedLocations,
        unlockedLocations: session.unlockedLocations,
      });
    }
  });

  socket.on("unlock-location", ({ sessionId, locationKey }) => {
    const session = sessions[sessionId];
    if (session) {
      session.completedLocations = session.completedLocations.filter(
        (loc) => loc !== locationKey,
      );
      if (!session.unlockedLocations.includes(locationKey))
        session.unlockedLocations.push(locationKey);
      io.to(sessionId).emit("location-status-changed", {
        completedLocations: session.completedLocations,
        unlockedLocations: session.unlockedLocations,
      });
    }
  });

  socket.on("mark-zone-complete", ({ sessionId, zoneName }) => {
    const session = sessions[sessionId];
    if (session && !session.completedZones.includes(zoneName)) {
      session.completedZones.push(zoneName);
      session.unlockedZones = session.unlockedZones.filter(
        (z) => z !== zoneName,
      );
      io.to(sessionId).emit("zone-status-changed", {
        completedZones: session.completedZones,
        unlockedZones: session.unlockedZones,
      });
    }
  });

  socket.on("unlock-zone", ({ sessionId, zoneName }) => {
    const session = sessions[sessionId];
    if (session) {
      session.completedZones = session.completedZones.filter(
        (z) => z !== zoneName,
      );
      if (!session.unlockedZones.includes(zoneName))
        session.unlockedZones.push(zoneName);
      io.to(sessionId).emit("zone-status-changed", {
        completedZones: session.completedZones,
        unlockedZones: session.unlockedZones,
      });
    }
  });

  socket.on("disconnect", () => console.log(`User disconnected: ${socket.id}`));
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
