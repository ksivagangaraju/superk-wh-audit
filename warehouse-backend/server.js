// warehouse-backend/server.js

require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// 🚀 MONGODB CONNECTION
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// 🚀 MONGODB SCHEMA DESIGN
const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  masterData: { type: Array, default: [] },
  zonesList: { type: Array, default: [] },
  completedZones: { type: Array, default: [] },
  unlockedZones: { type: Array, default: [] },
  completedLocations: { type: Array, default: [] },
  unlockedLocations: { type: Array, default: [] },
  isAuditRunning: { type: Boolean, default: false },
  dispatchData: { type: Array, default: [] },
  isDispatchRunning: { type: Boolean, default: false },
});
const Session = mongoose.model("Session", sessionSchema);

// REST APIs
app.post("/api/create-session", async (req, res) => {
  const { sessionId } = req.body;
  try {
    let session = await Session.findOne({ sessionId });
    if (!session) {
      session = new Session({ sessionId });
      await session.save();
    }
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/set-data", async (req, res) => {
  const { data, zones, sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "Session ID required" });

  try {
    let session = await Session.findOne({ sessionId });
    if (!session) session = new Session({ sessionId });

    session.masterData = data;
    session.zonesList = zones;
    session.completedZones = [];
    session.unlockedZones = [];
    session.completedLocations = [];
    session.unlockedLocations = [];
    session.isAuditRunning = false;

    await session.save();
    io.to(sessionId).emit("data-uploaded");
    res.status(200).json({ success: true, sessionId });
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/status/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = await Session.findOne({ sessionId });
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
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/clear-session", async (req, res) => {
  const { sessionId } = req.body;
  try {
    await Session.deleteOne({ sessionId });
    io.to(sessionId).emit("session-cleared");
    res.status(200).send("Session completely deleted from DB");
  } catch (error) {
    res.status(500).send("Database error");
  }
});

// SOCKET EVENTS (Realtime with DB updates)
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-session", async (sessionId) => {
    socket.rooms.forEach((room) => {
      if (room !== socket.id) socket.leave(room);
    });
    socket.join(sessionId);
    const session = await Session.findOne({ sessionId });
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

  // --- INVENTORY SOCKETS (FIXED FOR CONCURRENCY) ---
  socket.on("toggle-audit-state", async ({ sessionId, status }) => {
    await Session.updateOne(
      { sessionId },
      { $set: { isAuditRunning: status } },
    );
    io.to(sessionId).emit("audit-state-changed", status);
  });

  socket.on("update-item", async ({ sessionId, updatedItem }) => {
    // 🔥 Fix: Atomic array update prevents VersionError crash
    const result = await Session.updateOne(
      { sessionId, "masterData.uid": updatedItem.uid },
      { $set: { "masterData.$": updatedItem } },
    );

    if (result.matchedCount > 0) {
      io.to(sessionId).emit("item-updated", updatedItem);
    }
  });

  socket.on("mark-location-complete", async ({ sessionId, locationKey }) => {
    // 🔥 Fix: Using $addToSet and $pull to prevent array conflicts
    const updated = await Session.findOneAndUpdate(
      { sessionId },
      {
        $addToSet: { completedLocations: locationKey },
        $pull: { unlockedLocations: locationKey },
      },
      { new: true },
    );
    if (updated) {
      io.to(sessionId).emit("location-status-changed", {
        completedLocations: updated.completedLocations,
        unlockedLocations: updated.unlockedLocations,
      });
    }
  });

  socket.on("unlock-location", async ({ sessionId, locationKey }) => {
    const updated = await Session.findOneAndUpdate(
      { sessionId },
      {
        $pull: { completedLocations: locationKey },
        $addToSet: { unlockedLocations: locationKey },
      },
      { new: true },
    );
    if (updated) {
      io.to(sessionId).emit("location-status-changed", {
        completedLocations: updated.completedLocations,
        unlockedLocations: updated.unlockedLocations,
      });
    }
  });

  socket.on("mark-zone-complete", async ({ sessionId, zoneName }) => {
    const updated = await Session.findOneAndUpdate(
      { sessionId },
      {
        $addToSet: { completedZones: zoneName },
        $pull: { unlockedZones: zoneName },
      },
      { new: true },
    );
    if (updated) {
      io.to(sessionId).emit("zone-status-changed", {
        completedZones: updated.completedZones,
        unlockedZones: updated.unlockedZones,
      });
    }
  });

  socket.on("unlock-zone", async ({ sessionId, zoneName }) => {
    const updated = await Session.findOneAndUpdate(
      { sessionId },
      {
        $pull: { completedZones: zoneName },
        $addToSet: { unlockedZones: zoneName },
      },
      { new: true },
    );
    if (updated) {
      io.to(sessionId).emit("zone-status-changed", {
        completedZones: updated.completedZones,
        unlockedZones: updated.unlockedZones,
      });
    }
  });

  // 🚀 DISPATCH SOCKETS & MERGE LOGIC (FIXED FOR CONCURRENCY)
  socket.on("toggle-dispatch-state", async ({ sessionId, status }) => {
    await Session.updateOne(
      { sessionId },
      { $set: { isDispatchRunning: status } },
    );
    io.to(sessionId).emit("dispatch-state-changed", status);
  });

  socket.on("update-dispatch-excel", async ({ sessionId, excelData }) => {
    const session = await Session.findOne({ sessionId });
    if (session) {
      let mergedData;
      if (!session.dispatchData || session.dispatchData.length === 0) {
        mergedData = excelData;
      } else {
        mergedData = excelData.map((newStore) => {
          const existingStore = session.dispatchData.find(
            (s) => s.StoreName === newStore.StoreName,
          );
          if (existingStore) {
            return {
              ...newStore,
              AcceptedCartons: existingStore.AcceptedCartons || [],
              RejectedCartons: existingStore.RejectedCartons || [],
              ScannedBy: existingStore.ScannedBy || {},
              PalletNumber: existingStore.PalletNumber || newStore.PalletNumber,
            };
          }
          return newStore;
        });
      }

      // 🔥 Fix: Direct Update bypassing version conflicts
      await Session.updateOne(
        { sessionId },
        { $set: { dispatchData: mergedData } },
      );
      io.to(sessionId).emit("dispatch-data-updated", mergedData);
    }
  });

  // 🚀 CLEAR DISPATCH DATA
  socket.on("clear-dispatch-data", async (sessionId) => {
    await Session.updateOne(
      { sessionId },
      { $set: { dispatchData: [], isDispatchRunning: false } },
    );
    io.to(sessionId).emit("dispatch-data-updated", []);
    io.to(sessionId).emit("dispatch-state-changed", false);
  });

  // 🚀 CLEAR INVENTORY DATA
  socket.on("clear-inventory-data", async (sessionId) => {
    const updated = await Session.findOneAndUpdate(
      { sessionId },
      { $set: { masterData: [], zonesList: [], isAuditRunning: false } },
      { new: true },
    );
    if (updated) {
      io.to(sessionId).emit("initial-status", updated);
    }
  });

  socket.on(
    "verify-dispatch-carton",
    async ({ sessionId, currentPallet, cartonNumber, userName }) => {
      const session = await Session.findOne({ sessionId });
      if (!session || !session.dispatchData) return;

      if (!session.isDispatchRunning) {
        return socket.emit("dispatch-scan-result", {
          success: false,
          message: "Dispatch is currently ON HOLD by Admin!",
        });
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

      // 🔥 Fix: Direct update instead of save() to bypass version conflicts during dispatch
      await Session.updateOne(
        { sessionId },
        { $set: { dispatchData: session.dispatchData } },
      );

      io.to(sessionId).emit("dispatch-data-updated", session.dispatchData);
    },
  );

  socket.on("disconnect", () => console.log(`User disconnected: ${socket.id}`));
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
