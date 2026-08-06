
import React, { useEffect, useState, useRef } from 'react';
import { fetchManagers, fetchMappings } from '../api/managersApi';
import { CaretDown, User, Users } from 'phosphor-react';
import { motion, AnimatePresence } from 'framer-motion';

const ManagerSubPersonInput = ({ value, onChange, placeholder, required, readOnly, onFocus, onBlur }) => {
    const [managers, setManagers] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [selectedMgr, setSelectedMgr] = useState('');
    const [subPerson, setSubPerson] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        fetchManagers().then(setManagers).catch(console.error);
        fetchMappings().then(setMappings).catch(console.error);
    }, []);

    useEffect(() => {
        if (value) {
            const parts = value.split(' - ');
            if (parts.length > 1) {
                setSelectedMgr(parts[0]);
                setSubPerson(parts[1]);
            } else {
                // If it's a legacy value like "Vishal", it might not have the "Part - Part" format
                // but if we find it in mappings, we might want to resolve its manager?
                // For now, assume it's either "Manager" or "Manager - Member"
                setSelectedMgr(value);
                setSubPerson('');
            }
        } else {
            setSelectedMgr('');
            setSubPerson('');
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectMgr = (mgr) => {
        setSelectedMgr(mgr);
        setShowDropdown(false);
        const newValue = subPerson ? `${mgr} - ${subPerson}` : mgr;
        onChange(newValue);
    };

    const handleSubPersonChange = (person) => {
        setSubPerson(person);
        const newValue = selectedMgr ? `${selectedMgr} - ${person}` : person;
        onChange(newValue);
    };

    const suggestedMembers = mappings
        .filter(m => m.manager_name === selectedMgr)
        .map(m => m.member_name);

    if (readOnly) {
        return (
            <div className="w-full border border-gray-100 p-3 rounded-2xl text-sm text-gray-900 bg-gray-50/50 font-semibold flex items-center gap-2">
                <User size={16} className="text-gray-400" />
                {value || 'Not assigned'}
            </div>
        );
    }

    return (
        <div className="relative w-full font-urbanist" ref={dropdownRef}>
            <div 
                className={`flex items-center gap-2 border border-gray-200 bg-white rounded-2xl px-3 py-2.5 transition-all duration-300 focus-within:ring-4 focus-within:ring-brandOrange/5 focus-within:border-brandOrange group cursor-text shadow-sm ${selectedMgr ? 'border-brandOrange/30' : ''}`}
                onClick={() => !selectedMgr && setShowDropdown(true)}
            >
                <div className={`p-1.5 rounded-lg transition-colors ${selectedMgr ? 'bg-brandOrange text-white' : 'bg-gray-100 text-gray-500 group-focus-within:bg-brandOrange group-focus-within:text-white'}`}>
                    <User size={14} weight="bold" />
                </div>
                
                {selectedMgr && (
                    <div className="flex items-center gap-2 bg-gray-900 text-white px-3 py-1 rounded-xl text-[10px] font-bold shrink-0 shadow-lg shadow-gray-200 animate-in fade-in zoom-in duration-300">
                        {selectedMgr}
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSelectMgr('');
                            }}
                            className="hover:text-brandOrange transition-colors text-lg leading-none"
                        >
                            ×
                        </button>
                    </div>
                )}

                <input
                    type="text"
                    value={subPerson}
                    onChange={(e) => handleSubPersonChange(e.target.value)}
                    onFocus={(e) => {
                        if (!selectedMgr) setShowDropdown(true);
                        if (onFocus) onFocus(e);
                    }}
                    placeholder={selectedMgr ? "Type Program Manager Name..." : "Select Headed By First..."}
                    className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-gray-900 placeholder:text-gray-400 py-0.5"
                    list={selectedMgr ? `suggestions-${selectedMgr}` : undefined}
                    required={required}
                    onBlur={onBlur}
                />

                {selectedMgr && (
                    <datalist id={`suggestions-${selectedMgr}`}>
                        {suggestedMembers.map(m => (
                            <option key={m} value={m} />
                        ))}
                    </datalist>
                )}

                {!selectedMgr && (
                    <CaretDown 
                        size={14} 
                        weight="bold"
                        className={`text-gray-400 transition-transform duration-300 ${showDropdown ? 'rotate-180' : ''}`} 
                    />
                )}
            </div>

            <AnimatePresence>
                {showDropdown && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute z-[100] w-full mt-2 bg-white border border-gray-100 shadow-2xl rounded-3xl overflow-hidden p-2"
                    >
                        <div className="px-3 py-2 mb-1 border-b border-gray-50 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Identify Headed By</span>
                            <Users size={14} className="text-gray-300" />
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                            {managers.length > 0 ? (
                                managers.map((m) => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => handleSelectMgr(m.name)}
                                        className="w-full text-left px-3 py-3 text-[11px] font-bold text-gray-600 hover:bg-gray-900 hover:text-white transition-all rounded-2xl flex items-center gap-3 group"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-brandOrange opacity-0 group-hover:opacity-100 transition-opacity" />
                                        {m.name}
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-8 text-center">
                                    <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">No managers found</p>
                                    <p className="text-[10px] text-gray-400 mt-1">Add them in Manager Management</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ManagerSubPersonInput;
