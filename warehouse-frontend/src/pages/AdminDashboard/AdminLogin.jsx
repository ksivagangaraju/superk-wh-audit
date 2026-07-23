import React, { useState } from "react";
import CustomButton from "../../components/CustomButton";

const AdminLogin = ({
  inputSessionId,
  setInputSessionId,
  handleJoinOrCreate,
}) => {
  const [password, setPassword] = useState("");

  const onLoginClick = () => {
    // 🔐 Admin Password check
    if (password !== "superk@123") {
      alert("Incorrect Admin Password!");
      return;
    }
    handleJoinOrCreate();
  };

  return (
    <div
      className="screen-container bg-light"
      style={{ justifyContent: "center", alignItems: "center" }}
    >
      <div
        className="card-box text-center"
        style={{
          margin: "0",
          maxWidth: "400px",
          width: "100%",
          padding: "40px 20px",
        }}
      >
        <h2>👑 Admin Login</h2>
        <p className="text-muted mt-2">Enter Team ID and Password</p>

        <div style={{ padding: "10px", marginTop: "20px" }}>
          <input
            type="text"
            placeholder="Create or Enter Team ID (min 6 chars)"
            value={inputSessionId}
            onChange={(e) => setInputSessionId(e.target.value)}
            className="modal-input"
            style={{ marginBottom: "15px" }}
          />
          <input
            type="password"
            placeholder="Admin Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="modal-input"
            style={{ marginBottom: "20px" }}
          />
          <CustomButton
            text="Login to Workspace"
            variant="primary"
            fullWidth={true}
            onClick={onLoginClick}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
