import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash, UserCircle, Circle, Users } from "phosphor-react";
import { fetchManagers, fetchMappings, createManager, deleteManager } from "../api/managersApi";


const ManagersAdminPage = () => {
    const [mappings, setMappings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [managerName, setManagerName] = useState("");
    const [memberName, setMemberName] = useState("");
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await fetchMappings();
            setMappings(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        const finalManager = managerName.trim();
        if (!finalManager) {
            alert("Manager name is required.");
            return;
        }
        try {
            setSaving(true);
            await createManager(finalManager, memberName.trim());
            setMemberName("");
            await loadData();
        } catch (err) {
            alert(err.message || "Failed to add manager mapping");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to remove this mapping?")) return;
        try {
            await deleteManager(id);
            await loadData();
        } catch (err) {
            alert("Failed to delete mapping");
        }
    };

    return (
        <motion.div
            className="min-h-[calc(100vh-80px)] bg-brandBg px-2 sm:px-4 pt-0 pb-4 flex flex-col gap-4 relative"
            style={{ margin: "-16px -8px" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <div className="flex items-baseline gap-3 px-2 pt-2">
                <h1 className="font-marcellus font-bold text-xl sm:text-2xl text-gray-900 tracking-tight leading-none">Managers</h1>
                <span className="text-gray-300 text-sm hidden sm:inline">|</span>
                <p className="text-[10px] sm:text-xs text-gray-500 italic leading-none">Admin Configuration</p>
            </div>

            <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 sm:p-8 rounded-3xl shadow-xl border border-white/5 text-white overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
                <div className="relative z-10">
                    <h1 className="text-2xl sm:text-3xl font-marcellus font-bold mb-3 flex items-center gap-3">
                        <UserCircle size={32} weight="fill" className="text-brandOrange" />
                        Managers Management
                    </h1>
                    <div className="space-y-2 text-gray-300 text-sm max-w-2xl leading-relaxed">
                        <p className="font-semibold text-gray-100 flex items-center gap-2">
                             <Circle size={6} weight="fill" className="text-brandOrange" />
                             This page manages Managers for system-wide filtering.
                        </p>
                        <p>Managers added here will:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-xs sm:text-sm">
                            <li>Appear in "Identified By" across all modules</li>
                            <li>Be used in navbar filtering for quick analysis</li>
                            <li>Control Dashboard & Monitoring data visibility</li>
                        </ul>
                        <p className="bg-white/10 px-3 py-2 rounded-lg mt-4 border border-white/10 text-xs italic">
                            Selecting a manager filters all records under them across the entire platform.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Add Section */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-900">
                        <Plus size={20} weight="bold" className="text-brandOrange" />
                        Create New Mapping
                    </h2>
                    <form onSubmit={handleAdd} className="space-y-5">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Headed By</label>
                            <input
                                type="text"
                                value={managerName}
                                onChange={(e) => setManagerName(e.target.value)}
                                placeholder="e.g. Ajay"
                                className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-brandOrange outline-none transition-all"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Program Manager</label>
                            <input
                                type="text"
                                value={memberName}
                                onChange={(e) => setMemberName(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-brandDark outline-none transition-all"
                                placeholder="e.g. Vishal"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-gray-200 disabled:opacity-50 active:scale-[0.98]"
                        >
                            {saving ? "Creating..." : "Save Mapping"}
                        </button>
                    </form>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                            <Users size={20} weight="bold" className="text-brandOrange" />
                            Active Mappings
                        </h2>
                        <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-1 rounded-md border border-gray-100 uppercase tracking-wider">
                           {mappings.length} Total
                        </span>
                    </div>
                    
                    <div className="p-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 grayscale opacity-50">
                                <Users size={40} className="animate-pulse" />
                                <p className="text-xs font-medium uppercase tracking-widest text-gray-400">Syncing with system...</p>
                            </div>
                        ) : mappings.length === 0 ? (
                            <div className="text-center py-20">
                                <p className="text-gray-400 text-sm">No mappings configured yet.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col space-y-6">
                                {Object.entries(
                                    mappings.reduce((acc, m) => {
                                        const key = (m.manager_name || "Unknown").trim();
                                        const lowerKey = key.toLowerCase();
                                        const existingKey = Object.keys(acc).find(k => k.toLowerCase() === lowerKey);
                                        const finalKey = existingKey || key;
                                        
                                        if (!acc[finalKey]) acc[finalKey] = [];
                                        acc[finalKey].push(m);
                                        return acc;
                                    }, {})
                                ).map(([mgr, members]) => (
                                    <div key={mgr} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                                            <UserCircle size={20} className="text-brandOrange" weight="duotone" />
                                            <span className="font-bold text-gray-800 tracking-wide uppercase text-sm">{mgr}</span>
                                        </div>
                                        <div className="divide-y divide-gray-100">
                                            {members.map(m => (
                                                <div key={m.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-6 w-1 bg-brandOrange/80 rounded-full"></div>
                                                        <span className="text-sm font-semibold text-gray-600">{m.member_name}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDelete(m.id)}
                                                        className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                                        title="Remove Mapping"
                                                    >
                                                        <Trash size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};


export default ManagersAdminPage;
