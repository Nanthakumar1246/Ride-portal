import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, WarningCircle, ShieldCheck, User, List, Calendar } from "phosphor-react";
import { formatDisplayDate } from "../utils/dateFormat";

const getStatusIcon = (status) => {
  if (status === 'Open') return <WarningCircle size={16} className="text-red-500" weight="fill" />;
  if (status === 'Resolved') return <CheckCircle size={16} className="text-emerald-500" weight="fill" />;
  if (status === 'Approved & Closed') return <ShieldCheck size={16} className="text-green-500" weight="fill" />;
  return <div className="w-2 h-2 rounded-full bg-gray-400" />;
};

const getPriorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'critical': return 'text-red-600 bg-red-50 border-red-100';
    case 'high': return 'text-orange-600 bg-orange-50 border-orange-100';
    case 'medium': return 'text-amber-600 bg-amber-50 border-amber-100';
    case 'low': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    default: return 'text-gray-600 bg-gray-50 border-gray-100';
  }
};

export default function ResponsibleActionsChart({ data = [], details = [] }) {
  const [selectedPerson, setSelectedPerson] = useState(null);

  // Default selection to "Sathish" if available on first load
  useEffect(() => {
    if (!selectedPerson && data.length > 0) {
        const sathish = data.find(d => d.responsible === "Sathish");
        if (sathish) {
            setSelectedPerson("Sathish");
        } else if (data[0]) {
            setSelectedPerson(data[0].responsible);
        }
    }
  }, [data]);

  // Sort data by count descending
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...sortedData.map((d) => d.count), 1);
  const totalActions = sortedData.reduce((acc, curr) => acc + curr.count, 0);

  const selectedDetails = details.filter(d => d.responsible === selectedPerson);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
        <div>
          <h3 className="text-xl font-marcellus font-bold text-gray-900 leading-tight flex items-center gap-2">
            <User size={24} weight="duotone" className="text-brandDark" />
            Top Action Owners
          </h3>
          <p className="text-xs font-urbanist font-semibold text-gray-400 uppercase tracking-widest mt-1">
            Workload Distribution — {totalActions} Total Actions
          </p>
        </div>
        {selectedPerson && (
          <button 
            onClick={() => setSelectedPerson(null)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-all"
          >
            <X size={14} weight="bold" /> RESET VIEW
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Panel: Funnel Chart */}
        <motion.div 
          layout
          className="border-b lg:border-b-0 lg:border-r border-gray-50 bg-white p-4 sm:p-8 flex flex-col"
          initial={false}
          animate={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? (selectedPerson ? "40%" : "100%") : "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="flex flex-col justify-center gap-4 sm:gap-6 max-w-3xl mx-auto w-full py-4">
            {sortedData.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-urbanist italic">No ownership data found.</div>
            ) : (
              sortedData.map((item, index) => {
                const widthPct = (item.count / maxCount) * 100;
                const isSelected = selectedPerson === item.responsible;
                const sharePct = Math.round((item.count / totalActions) * 100);

                return (
                  <motion.div
                    key={item.responsible}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group"
                  >
                    <div className="flex items-center justify-between mb-1.5 px-2">
                        <span className={`text-xs font-bold tracking-tight transition-colors ${isSelected ? "text-brandDark" : "text-gray-500 group-hover:text-gray-800"}`}>
                            {item.responsible}
                        </span>
                        <span className="text-[10px] font-black text-gray-300 group-hover:text-brandDark transition-colors">
                            {sharePct}% SHARE
                        </span>
                    </div>

                    <div 
                      onClick={() => setSelectedPerson(isSelected ? null : item.responsible)}
                      className={`relative h-12 w-full cursor-pointer flex items-center transition-all duration-300 ${
                        isSelected ? "scale-[1.02] z-10" : "hover:scale-[1.01]"
                      }`}
                    >
                      {/* Bar Background (Glassmorphism look) */}
                      <div className="absolute inset-0 bg-gray-50 rounded-lg border border-gray-100 shadow-inner" />
                      
                      {/* Animated Progress Bar */}
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: index * 0.1 }}
                        className={`absolute left-0 h-full rounded-lg shadow-lg flex items-center justify-end pr-4 overflow-hidden ${
                          isSelected 
                          ? "bg-gradient-to-r from-brandDark to-black" 
                          : "bg-gradient-to-r from-blue-600 to-indigo-700 opacity-80 group-hover:opacity-100"
                        }`}
                      >
                        {/* Glow effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
                        
                        <span className="text-white font-black text-sm relative z-10">
                          {item.count}
                        </span>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Right Panel: Details Table */}
        <AnimatePresence>
          {selectedPerson && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full lg:w-[60%] bg-gray-50/50 flex flex-col shadow-2xl z-20"
            >
              <div className="p-6 bg-white border-b border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-marcellus font-bold text-gray-900">
                    {selectedPerson}'s Portfolio
                  </h4>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                    Individual Action Item Breakdown
                  </p>
                </div>
                <div className="bg-brandDark/5 text-brandDark px-3 py-1 rounded-full text-xs font-black">
                  {selectedDetails.length} ITEMS
                </div>
              </div>

              <div className="overflow-auto p-3 sm:p-6 max-h-[400px] lg:max-h-none">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-gray-50/80 backdrop-blur-md z-10">
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-tighter">Status</th>
                      <th className="px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-tighter w-1/3">Action Item</th>
                      <th className="px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-tighter">ID</th>
                      <th className="px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-tighter">Priority</th>
                      <th className="px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-tighter">Target Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedDetails.length === 0 ? (
                        <tr><td colSpan="5" className="py-10 text-center italic text-gray-400">No details available.</td></tr>
                    ) : (
                      selectedDetails.map((action, idx) => (
                        <motion.tr 
                          key={action.action_id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="hover:bg-white transition-colors"
                        >
                          <td className="px-3 py-4">
                            {getStatusIcon(action.status)}
                          </td>
                          <td className="px-3 py-4">
                            <div className="text-xs font-bold text-gray-800 line-clamp-1" title={action.action_title}>
                                {action.action_title}
                            </div>
                            <div className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-tighter font-semibold">
                                {action.teams_involved || "Internal"}
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                {action.action_id}
                            </span>
                          </td>
                          <td className="px-3 py-4">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${getPriorityColor(action.priority)}`}>
                              {action.priority?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 whitespace-nowrap">
                                <Calendar size={12} weight="duotone" className="text-brandDark" />
                                {formatDisplayDate(action.target_date)}
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center text-[10px] font-bold text-gray-400">
        <div className="flex gap-4">
            <span className="flex items-center gap-1"><WarningCircle className="text-red-500" /> OPEN</span>
            <span className="flex items-center gap-1"><CheckCircle className="text-emerald-500" /> RESOLVED</span>
        </div>
        <div className="flex items-center gap-2 italic">
            <List size={14} /> Click on any owner to view individual breakdown
        </div>
      </div>
    </div>
  );
}
