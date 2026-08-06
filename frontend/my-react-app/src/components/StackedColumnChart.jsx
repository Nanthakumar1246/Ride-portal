
import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";

const STATUS_ORDER = ["Open", "In Progress", "Resolved", "Cancelled", "Approved & Closed"];

const COLORS = {
  Open: "#E63946",
  "On Hold": "#8B5CF6",
  "In Progress": "#FB8500",
  Resolved: "#457B9D",
  Cancelled: "#8D99AE",
  "Approved & Closed": "#1EA896",
};

export default function StackedColumnChart({ data = [] }) {



  const sortedData = useMemo(() => {
    return [...data].sort((a, b) =>
      String(a.module || "").localeCompare(String(b.module || ""))
    );
  }, [data]);


  const statusKeys = useMemo(() => {
    const keys = [...new Set(sortedData.flatMap(row =>
      Object.keys(row).filter(k => k !== "module")
    ))];

    return keys.sort((a, b) => {
      const idxA = STATUS_ORDER.indexOf(a);
      const idxB = STATUS_ORDER.indexOf(b);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }, [sortedData]);


  if (!data.length) {
    return (
      <div style={{ padding: 20, color: "#999" }}>
        No module data available
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart
          data={sortedData}
          margin={{ top: 4, right: 8, left: -10, bottom: 16 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="module"
            tick={{ fontSize: 9, fontWeight: 700, fill: "#6B7280" }}
            axisLine={{ stroke: "#D1D5DB", strokeWidth: 1 }}
            tickLine={{ stroke: "#D1D5DB" }}
            interval={0}
            tickFormatter={(val) => {
              if (!val) return "";
              if (val === "Dependency") return "Depend";
              if (val === "Escalation") return "Escalation";
              return val;
            }}
          />
          <YAxis
            domain={[0, "auto"]}
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "#6B7280" }}
            axisLine={{ stroke: "#D1D5DB", strokeWidth: 1 }}
            tickLine={{ stroke: "#D1D5DB" }}
          />
          <Tooltip
            contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 11 }}
            formatter={(value) => Number(value).toLocaleString()}
          />
          <Legend
            wrapperStyle={{ paddingTop: 4, fontSize: 10 }}
            verticalAlign="bottom"
            height={24}
          />
          {statusKeys.map((key, idx) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="status-stack"
              fill={COLORS[key] || "#ccc"}
              isAnimationActive={true}
              animationBegin={500 + (idx * 150)}
              animationDuration={800}
              animationEasing="ease-out"
              radius={idx === statusKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
