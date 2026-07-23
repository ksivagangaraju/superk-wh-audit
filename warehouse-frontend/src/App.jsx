import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

// 🚀 Admin Component Import
import AdminDashboard from "./pages/AdminDashboard/AdminDashboard";

// 🚀 User Component Import (Meeru create chesina main user file peru petti uncomment cheyandi)
import AuditWorkspace from "./pages/AuditWorkspace/AuditWorkspace";

import "./App.css";

// 🏠 Kotha Home Page Component
const Home = () => {
  return (
    <div
      className="screen-container bg-light"
      style={{ justifyContent: "center", alignItems: "center" }}
    >
      <div
        className="card-box text-center"
        style={{ maxWidth: "450px", width: "100%" }}
      >
        <h2>🏢 Warehouse Audit System</h2>
        <p className="text-muted mt-2">Select your portal to continue</p>

        <div
          style={{
            display: "flex",
            gap: "15px",
            marginTop: "25px",
            flexDirection: "column",
          }}
        >
          <Link to="/admin" style={{ textDecoration: "none" }}>
            <button
              className="btn-primary full-width"
              style={{ padding: "15px", fontSize: "16px" }}
            >
              👑 Admin Portal
            </button>
          </Link>

          <Link to="/workspace" style={{ textDecoration: "none" }}>
            <button
              className="btn-success full-width"
              style={{ padding: "15px", fontSize: "16px" }}
            >
              👥 User Workspace
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          {/* 🚀 Ippudu app open cheyagane Home page vasthundi */}
          <Route path="/" element={<Home />} />

          {/* 👑 Admin Route */}
          <Route path="/admin" element={<AdminDashboard />} />

          {/* 👥 User Route (Meeru file create chesaka idhi uncomment cheyandi) */}
          <Route path="/workspace" element={<AuditWorkspace />} />

          {/* 404 Error Page */}
          <Route
            path="*"
            element={
              <h2 style={{ textAlign: "center", marginTop: "50px" }}>
                404 - Page Not Found
              </h2>
            }
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
