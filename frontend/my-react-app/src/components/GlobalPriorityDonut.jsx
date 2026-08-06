
import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { fetchPrioritySplit } from "../api/metricsApi";


const COLORS = {
    Critical: "#DC2626",
    High: "#EA580C",
    Medium: "#D97706",
    Low: "#059669",
    Normal: "#2563EB",
};
const DEFAULT_COLOR = "#94A3B8";

const getColor = (priority) => {
    if (!priority) return DEFAULT_COLOR;

    if (COLORS[priority]) return COLORS[priority];

    const formatted = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
    return COLORS[formatted] || DEFAULT_COLOR;
};

const GlobalPriorityDonut = ({ onPrioritySelect, selectedPriority, data: externalData }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hovered, setHovered] = useState(null);

    useEffect(() => {
        if (externalData && externalData.length > 0) {
            setData(externalData);
            return;
        }

        const load = async () => {
            setLoading(true);
            try {

                const res = await fetchPrioritySplit('all');
                if (res?.success) {
                    setData(res.data || []);
                } else {
                    setData([]);
                }
            } catch (err) {
                console.error("Split Load Error:", err);
                setData([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [externalData]);

    const chartData = data.filter(d => d.count > 0);
    const totalCount = chartData.reduce((acc, curr) => acc + curr.count, 0);


    const activeLabel = hovered || selectedPriority || "Total Items";

    let activeCount = totalCount;
    if (activeLabel !== "Total Items") {
        const item = chartData.find(d => d.priority === activeLabel);
        activeCount = item ? item.count : 0;
    }

    const handleSliceClick = (entry) => {
        if (onPrioritySelect) {

            if (selectedPriority === entry.priority) {
                onPrioritySelect(null);
            } else {
                onPrioritySelect(entry.priority);
            }
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col h-full justify-center">
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0 min-h-[200px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-gray-400 font-urbanist">Loading Priorities...</span>
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center opacity-50">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                            <span className="text-xl">📊</span>
                        </div>
                        <span className="text-sm font-bold text-gray-500 font-urbanist">No Priority Data</span>
                        <span className="text-xs text-gray-400 font-urbanist mt-1">Add items to see insights</span>
                    </div>
                ) : (
                    <>
                        { }
                        <div className="w-full sm:w-1/2 h-[200px] sm:h-[220px] relative">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="count"
                                        nameKey="priority"
                                        stroke="none"
                                        onMouseEnter={(data) => setHovered(data.priority)}
                                        onMouseLeave={() => setHovered(null)}
                                        onClick={handleSliceClick}
                                        isAnimationActive={true}
                                        animationDuration={800}
                                    >
                                        {chartData.map((entry, index) => {
                                            const isSelected = selectedPriority === entry.priority;
                                            const isDimmed = selectedPriority && !isSelected;
                                            return (
                                                <Cell
                                                    key={'cell-' + index}
                                                    fill={getColor(entry.priority)}
                                                    style={{
                                                        opacity: isDimmed ? 0.3 : 1,
                                                        cursor: 'pointer',
                                                        transition: 'opacity 0.3s ease'
                                                    }}
                                                    stroke={isSelected ? "#000" : "none"}
                                                    strokeWidth={isSelected ? 2 : 0}
                                                />
                                            );
                                        })}
                                    </Pie>
                                    <Tooltip
                                        cursor={false}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#374151' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            { }
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none transition-all duration-300">
                                <span className={`block text-3xl font-bold font-montserrat ${selectedPriority && selectedPriority === activeLabel ? "text-red-600 scale-110" : "text-gray-800"}`}>
                                    {activeCount}
                                </span>
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-urbanist font-semibold">
                                    {activeLabel}
                                </span>
                            </div>
                        </div>

                        { }
                        <div className="w-full sm:w-1/2 sm:pl-4 flex flex-col justify-center space-y-2">
                            {chartData.map((item, idx) => {
                                const isSelected = selectedPriority === item.priority;
                                return (
                                    <div
                                        key={idx}
                                        className={`flex items-center justify-between text-sm py-1 border-b last:border-0 cursor-pointer transition-colors duration-200 ${isSelected ? "border-blue-200 bg-blue-50/50" : "border-gray-50 hover:bg-gray-50"}`}
                                        onClick={() => handleSliceClick(item)}
                                    >
                                        <div className="flex items-center">
                                            <span
                                                className="w-3 h-3 rounded-full mr-3 shadow-sm transition-transform duration-200"
                                                style={{
                                                    backgroundColor: getColor(item.priority),
                                                    transform: isSelected ? 'scale(1.2)' : 'scale(1)'
                                                }}
                                            ></span>
                                            <span className={`font-urbanist font-medium ${isSelected ? "text-gray-900 font-bold" : "text-gray-600"}`}>
                                                {item.priority}
                                            </span>
                                        </div>
                                        <span className={`font-bold px-2 py-0.5 rounded text-xs ${isSelected ? "bg-white text-blue-600 shadow-sm" : "text-gray-800 bg-gray-50"}`}>
                                            {item.count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            { }
            {
                !loading && chartData.length > 0 && (
                    <div className="mt-4 text-center">
                        <p className="text-[10px] text-gray-400 font-urbanist italic">
                            Click on specific priority levels (Low, High, etc.) to filter and track their contribution to the overall total.
                        </p>
                    </div>
                )
            }
        </div >
    );
};

export default GlobalPriorityDonut;
