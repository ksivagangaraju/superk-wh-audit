import React from "react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();

  return (
    <div
      className="screen-container bg-dark"
      style={{ justifyContent: "center", alignItems: "center" }}
    >
      <div className="card-box text-center">
        <h2 style={{ marginBottom: "10px" }}>📦 Warehouse Smart Audit</h2>
        <p className="text-muted" style={{ marginBottom: "30px" }}>
          Select your role to continue
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <button
            className="btn-success full-width"
            style={{ padding: "20px", fontSize: "18px" }}
            onClick={() => navigate("/admin")}
          >
            👑 Login as Admin (Monitor & Upload)
          </button>

          <button
            className="btn-primary full-width"
            style={{ padding: "20px", fontSize: "18px" }}
            onClick={() => navigate("/")}
          >
            👷 Login as User (Start Auditing)
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
