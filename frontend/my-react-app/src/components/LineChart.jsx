
import React, { useState, useMemo } from "react";
import {
  LineChart as RLineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function LineChart({ data = [] }) {
   
  const sortedData = useMemo(() => {
    const monthMap = new Map();
    data.forEach(item => {
      const monthName = item.month || "";
      monthMap.set(monthName, item.count || 0);
    });

    
    return MONTHS.map(month => ({
      month,
      count: monthMap.get(month) || 0,
    }));
  }, [data]);

  
  const maxCount = useMemo(() => {
    const max = Math.max(...sortedData.map(d => Number(d.count || 0)));
    return Math.max(max * 1.15, 10);
  }, [sortedData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {}
      <ResponsiveContainer width="100%" height={260}>
        <RLineChart data={sortedData}>
          <CartesianGrid stroke="#e6e6e6" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            stroke="#888"
            style={{ fontSize: 12 }}
          />
          <YAxis
            domain={[0, maxCount]}
            label={{ value: "Risk Count", angle: -90, position: "insideLeft" }}
            stroke="#888"
            style={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: 8,
              padding: 10,
            }}
            formatter={(value) => [Number(value).toLocaleString(), "Risks"]}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#1A73E8"
            strokeWidth={3}
            dot={{ r: 5, strokeWidth: 2, fill: "#fff", stroke: "#1A73E8" }}
            activeDot={{ r: 8, fill: "#1A73E8" }}
            isAnimationActive={true}
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
}
