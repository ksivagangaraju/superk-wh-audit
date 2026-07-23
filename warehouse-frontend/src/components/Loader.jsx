import React from "react";

const Loader = ({ text = "Processing, Please wait..." }) => {
  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 10500, flexDirection: "column" }}
    >
      <div
        style={{
          width: "50px",
          height: "50px",
          border: "5px solid #f3f3f3",
          borderTop: "5px solid #3b82f6",
          borderRadius: "50%",
          animation: "spin 1.5s linear infinite",
        }}
      ></div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <h3 style={{ color: "white", marginTop: "20px", fontWeight: "normal" }}>
        {text}
      </h3>
    </div>
  );
};

export default Loader;
