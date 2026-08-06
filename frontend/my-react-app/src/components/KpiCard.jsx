
import React, { useEffect, useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { ChartLineUp, WarningCircle, CheckCircle, ClipboardText, PauseCircle, ShieldCheck, XCircle } from "phosphor-react";

const iconMap = {
  "Open": <WarningCircle size={24} color="#D64550" weight="duotone" />,
  "Resolved": <CheckCircle size={24} color="#1EA896" weight="duotone" />,
  "Approved": <ShieldCheck size={24} color="#10B981" weight="duotone" />,
  "Cancelled": <XCircle size={24} color="#6B7280" weight="duotone" />,
  "Total Items": <ClipboardText size={24} color="#517493" weight="duotone" />,
};

const insightMap = {
  "Open": "Critical attention required for new items.",
  "Resolved": "Issues resolved, pending approval.",
  "Approved": "Verified and officially closed.",
  "Cancelled": "Items cancelled or discarded.",
  "Total Items": "Overall volume is trending upward.",
};

export default function KpiCard({ title, value }) {
  const [display, setDisplay] = useState(0);
  const aiText = insightMap[title] || "AI: Data analysis in progress...";

  useEffect(() => {
    let current = 0;
    const tick = () => {
      current += Math.ceil(value / 45);
      if (current >= value) current = value;
      setDisplay(current);
      if (current < value) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "16px",
        border: "1px solid #E1E6EB",
        display: "flex",
        flex: 1,
        minWidth: 0,
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        gap: 0,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
        textAlign: "left"
      }}
    >
      {/* Icon & Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {iconMap[title] || <ClipboardText size={24} color="#517493" weight="duotone" />}
        </div>
        <span style={{
          fontFamily: "Lato, sans-serif",
          fontWeight: 700,
          fontSize: 16,
          color: "#0B2341",
          textTransform: "none",
          letterSpacing: "0.02em"
        }}>
          {title}
        </span>
      </div>

      {/* Number */}
      <motion.span
        key={display}
        initial={{ scale: 0.95, opacity: 0.8 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          fontSize: "clamp(28px, 5vw, 48px)",
          fontFamily: "Lato, sans-serif",
          fontWeight: 800,
          color: "#0B2341",
          lineHeight: 1,
          display: "block",
          marginBottom: 8
        }}
      >
        {display}
      </motion.span>

      {/* Progress Bar */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 40 }}
        transition={{ duration: 0.6 }}
        style={{
          height: 3,
          borderRadius: 3,
          marginBottom: 20,
          background:
            value === 0
              ? "#8D99AE"
              : title === "Resolved"
                ? "#1EA896"
                : title === "Approved"
                  ? "#10B981"
                  : title === "Cancelled"
                    ? "#6B7280"
                    : "#D64550",
        }}
      />

      {/* AI Insight */}
      <p style={{
        fontSize: 13,
        color: "#517493",
        fontFamily: "Lato, sans-serif",
        lineHeight: "1.5",
        fontWeight: 400,
        maxWidth: "200px"
      }}>
        {aiText}
      </p>
    </motion.div>
  );
}
