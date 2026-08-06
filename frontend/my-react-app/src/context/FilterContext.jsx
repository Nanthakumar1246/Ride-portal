
import React, { createContext, useContext, useState, useEffect } from 'react';

const FilterContext = createContext();

export const FilterProvider = ({ children }) => {
    const [selectedManager, setSelectedManager] = useState(() => {
        return localStorage.getItem('ARCHERIDE_SELECTED_MANAGER') || 'All';
    });

    useEffect(() => {
        localStorage.setItem('ARCHERIDE_SELECTED_MANAGER', selectedManager);
    }, [selectedManager]);

    return (
        <FilterContext.Provider value={{ selectedManager, setSelectedManager }}>
            {children}
        </FilterContext.Provider>
    );
};

export const useFilter = () => {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error('useFilter must be used within a FilterProvider');
    }
    return context;
};
