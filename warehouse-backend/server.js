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
      dispatchData: [],
      isDispatchRunning: false,
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
    dispatchData: session.dispatchData,
    isDispatchRunning: session.isDispatchRunning,
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
    socket.rooms.forEach((room) => {
      if (room !== socket.id) socket.leave(room);
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
        dispatchData: session.dispatchData,
        isDispatchRunning: session.isDispatchRunning,
      });
    }
  });

  socket.on("leave-session", (sessionId) => socket.leave(sessionId));

  // --- INVENTORY SOCKETS ---
  socket.on("toggle-audit-state", ({ sessionId, status }) => {
    if (sessions[sessionId]) {
      sessions[sessionId].isAuditRunning = status;
      io.to(sessionId).emit("audit-state-changed", status);
    }
  });

  socket.on("update-item", ({ sessionId, updatedItem }) => {
    if (sessions[sessionId]) {
      const index = sessions[sessionId].masterData.findIndex(
        (p) => p.uid === updatedItem.uid,
      );
      if (index !== -1) {
        sessions[sessionId].masterData[index] = updatedItem;
        io.to(sessionId).emit("item-updated", updatedItem);
      }
    }
  });

  socket.on("mark-location-complete", ({ sessionId, locationKey }) => {
    if (
      sessions[sessionId] &&
      !sessions[sessionId].completedLocations.includes(locationKey)
    ) {
      sessions[sessionId].completedLocations.push(locationKey);
      sessions[sessionId].unlockedLocations = sessions[
        sessionId
      ].unlockedLocations.filter((loc) => loc !== locationKey);
      io.to(sessionId).emit("location-status-changed", {
        completedLocations: sessions[sessionId].completedLocations,
        unlockedLocations: sessions[sessionId].unlockedLocations,
      });
    }
  });

  socket.on("unlock-location", ({ sessionId, locationKey }) => {
    if (sessions[sessionId]) {
      sessions[sessionId].completedLocations = sessions[
        sessionId
      ].completedLocations.filter((loc) => loc !== locationKey);
      if (!sessions[sessionId].unlockedLocations.includes(locationKey))
        sessions[sessionId].unlockedLocations.push(locationKey);
      io.to(sessionId).emit("location-status-changed", {
        completedLocations: sessions[sessionId].completedLocations,
        unlockedLocations: sessions[sessionId].unlockedLocations,
      });
    }
  });

  socket.on("mark-zone-complete", ({ sessionId, zoneName }) => {
    if (
      sessions[sessionId] &&
      !sessions[sessionId].completedZones.includes(zoneName)
    ) {
      sessions[sessionId].completedZones.push(zoneName);
      sessions[sessionId].unlockedZones = sessions[
        sessionId
      ].unlockedZones.filter((z) => z !== zoneName);
      io.to(sessionId).emit("zone-status-changed", {
        completedZones: sessions[sessionId].completedZones,
        unlockedZones: sessions[sessionId].unlockedZones,
      });
    }
  });

  socket.on("unlock-zone", ({ sessionId, zoneName }) => {
    if (sessions[sessionId]) {
      sessions[sessionId].completedZones = sessions[
        sessionId
      ].completedZones.filter((z) => z !== zoneName);
      if (!sessions[sessionId].unlockedZones.includes(zoneName))
        sessions[sessionId].unlockedZones.push(zoneName);
      io.to(sessionId).emit("zone-status-changed", {
        completedZones: sessions[sessionId].completedZones,
        unlockedZones: sessions[sessionId].unlockedZones,
      });
    }
  });

  // --- DISPATCH SOCKETS ---
  socket.on("toggle-dispatch-state", ({ sessionId, status }) => {
    if (sessions[sessionId]) {
      sessions[sessionId].isDispatchRunning = status;
      io.to(sessionId).emit("dispatch-state-changed", status);
    }
  });

  socket.on("update-dispatch-excel", ({ sessionId, excelData }) => {
    if (sessions[sessionId]) {
      sessions[sessionId].dispatchData = excelData;
      io.to(sessionId).emit(
        "dispatch-data-updated",
        sessions[sessionId].dispatchData,
      );
    }
  });

  socket.on("map-pallet-to-store", ({ sessionId, storeName, palletNumber }) => {
    if (sessions[sessionId] && sessions[sessionId].dispatchData) {
      const store = sessions[sessionId].dispatchData.find(
        (s) => s.StoreName === storeName,
      );
      if (store) store.PalletNumber = palletNumber;
      io.to(sessionId).emit(
        "dispatch-data-updated",
        sessions[sessionId].dispatchData,
      );
    }
  });

  socket.on(
    "verify-dispatch-carton",
    ({ sessionId, currentPallet, cartonNumber, userName }) => {
      const session = sessions[sessionId];
      if (!session || !session.dispatchData) return;
      if (!session.isDispatchRunning) {
        socket.emit("dispatch-scan-result", {
          success: false,
          message: "Dispatch is currently ON HOLD by Admin!",
        });
        return;
      }
      const correctStore = session.dispatchData.find((s) =>
        s.ExpectedCartons.includes(cartonNumber),
      );
      const currentStore = session.dispatchData.find(
        (s) => s.PalletNumber === currentPallet,
      );
      if (!currentStore)
        return socket.emit("dispatch-scan-result", {
          success: false,
          message: "Invalid Pallet!",
        });

      if (!currentStore.ScannedBy) currentStore.ScannedBy = {};

      if (!correctStore) {
        socket.emit("dispatch-scan-result", {
          success: false,
          message: `❌ Rejected: ${cartonNumber} not in today's list!`,
        });
      } else if (correctStore.PalletNumber === currentPallet) {
        if (!currentStore.AcceptedCartons.includes(cartonNumber)) {
          currentStore.AcceptedCartons.push(cartonNumber);
          currentStore.ScannedBy[cartonNumber] = {
            user: userName,
            msg: "Verified",
          };
        }
        socket.emit("dispatch-scan-result", {
          success: true,
          message: `✅ Accepted: ${cartonNumber}`,
        });
      } else {
        if (!currentStore.RejectedCartons.includes(cartonNumber)) {
          currentStore.RejectedCartons.push(cartonNumber);
          currentStore.ScannedBy[cartonNumber] = {
            user: userName,
            msg: `Belongs to ${correctStore.PalletNumber || "Unassigned"} (${correctStore.StoreName})`,
          };
        }
        socket.emit("dispatch-scan-result", {
          success: false,
          message: `❌ Rejected! This belongs to ${correctStore.PalletNumber || "Unassigned Pallet"} (${correctStore.StoreName})`,
        });
      }
      io.to(sessionId).emit("dispatch-data-updated", session.dispatchData);
    },
  );

  socket.on("disconnect", () => console.log(`User disconnected: ${socket.id}`));
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
