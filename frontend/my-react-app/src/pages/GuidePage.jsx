
import React from 'react';
import { motion } from 'framer-motion';
import { Info, Funnel, Users, Layout, ShieldCheck, ArrowRight } from 'phosphor-react';

const GuidePage = () => {
    return (
        <motion.div 
            className="min-h-screen bg-brandBg p-4 sm:p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="max-w-4xl mx-auto">
                <header className="mb-12">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 bg-brandDark text-white rounded-2xl flex items-center justify-center shadow-lg shadow-gray-200">
                            <Info size={28} weight="fill" />
                        </div>
                        <h1 className="text-3xl font-marcellus font-bold text-gray-900">System Guide</h1>
                    </div>
                    <p className="text-gray-500 text-lg">Understanding the Global Manager Filtering & Data Management System</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Feature 1: Navbar Filter */}
                    <motion.div 
                        className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group"
                        whileHover={{ y: -5, shadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                        <Funnel size={32} weight="duotone" className="text-blue-600 mb-6 relative z-10" />
                        <h2 className="text-xl font-bold text-gray-900 mb-4 relative z-10">Global Navbar Filter</h2>
                        <p className="text-sm text-gray-600 leading-relaxed relative z-10 mb-4">
                            The new manager filter in the top navbar allows you to slice data across the entire platform instantly. 
                            When you select a Manager, the Dashboard and all Module workboards will update to show only records mapped to that manager.
                        </p>
                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                            <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-1">How it works</p>
                            <p className="text-xs text-blue-600">Selecting "Ajay" will show records identified by Vishal, Sudhakar, and others mapped under him.</p>
                        </div>
                    </motion.div>

                    {/* Feature 2: Smart Identified By */}
                    <motion.div 
                        className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group"
                        whileHover={{ y: -5, shadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                        <Users size={32} weight="duotone" className="text-brandOrange mb-6 relative z-10" />
                        <h2 className="text-xl font-bold text-gray-900 mb-4 relative z-10">Smart "Identified By"</h2>
                        <p className="text-sm text-gray-600 leading-relaxed relative z-10 mb-4">
                            A dual-layered input field designed for precision. First, select the Primary Manager from the dropdown, then type or select the specific team member.
                        </p>
                        <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100/50">
                            <p className="text-[10px] font-bold text-orange-800 uppercase tracking-widest mb-1">Data Format</p>
                            <p className="text-xs text-orange-600 italic">Stores values as "Manager - Member" (e.g., Ajay - Vishal) for robust back-end tracking.</p>
                        </div>
                    </motion.div>

                     {/* Feature 3: Backward Compatibility */}
                    <motion.div 
                        className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group col-span-1"
                        whileHover={{ y: -5, shadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                        <ShieldCheck size={32} weight="duotone" className="text-green-600 mb-6 relative z-10" />
                        <h2 className="text-xl font-bold text-gray-900 mb-4 relative z-10">Historical Data Support</h2>
                        <p className="text-sm text-gray-600 leading-relaxed relative z-10 mb-4">
                            The system is built with backward compatibility. The filtering logic automatically maps legacy names (e.g., "Vishal") to their managers based on current configurations without requiring record updates.
                        </p>
                    </motion.div>

                    {/* Feature 4: Dashboard Stability */}
                    <motion.div 
                        className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group col-span-1"
                        whileHover={{ y: -5, shadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                        <Layout size={32} weight="duotone" className="text-purple-600 mb-6 relative z-10" />
                        <h2 className="text-xl font-bold text-gray-900 mb-4 relative z-10">Enhanced Dashboard Stability</h2>
                        <p className="text-sm text-gray-600 leading-relaxed relative z-10 mb-4">
                            We've standardized back-end queries to resolve column mismatch errors. All charts, sparklines, and project feeds now use unified date mapping (`created_at`) for 100% data availability.
                        </p>
                        <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100/50">
                             <p className="text-[10px] font-bold text-purple-800 uppercase tracking-widest mb-1">Restored Metrics</p>
                             <p className="text-xs text-purple-600 italic">Priority Donut, Module Status, Latest Risks/Issues feeds, and Engagement Trends are now live and real-time.</p>
                        </div>
                    </motion.div>
                </div>
                <div className="mt-8 bg-gray-50 border border-gray-100 p-6 rounded-3xl">
                    <h3 className="text-sm font-bold text-gray-900 mb-2">Technical Note: Centralized Mapping</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        The Relationship Mapping (e.g., Manoharan ➔ Vignesh Kumar) is centrally managed in the <code>managers_mapping.json</code> module. 
                        This allows the platform to dynamically group team contributions under a single manager view, even if the underlying database records use diverse naming conventions.
                    </p>
                </div>
                <footer className="mt-16 pt-8 border-t border-gray-100 text-center">
                    <p className="text-gray-400 text-xs uppercase tracking-[0.2em]">DigiTrac Platform Intelligence Guide v2.0</p>
                </footer>
            </div>
        </motion.div>
    );
};

export default GuidePage;
