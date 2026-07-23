import React from "react";

const CustomButton = ({
  text,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  fullWidth = false,
  icon,
  style,
}) => {
  const btnClass = `btn-${variant} ${size === "sm" ? "sm" : ""} ${fullWidth ? "full-width" : ""}`;
  return (
    <button
      className={btnClass}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {icon && <span style={{ marginRight: "8px" }}>{icon}</span>}
      {text}
    </button>
  );
};

export default CustomButton;
