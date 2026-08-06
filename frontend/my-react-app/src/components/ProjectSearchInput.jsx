import React, { useState, useEffect, useRef } from 'react';
import { searchProjects } from '../api/projectsApi';
import './ProjectSearchInput.css'; 

const ProjectSearchInput = ({ value, onChange, onSelect, placeholder, required, className, onFocus, onBlur }) => {
    const [query, setQuery] = useState(value || '');
    const [results, setResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const handleSearch = async (input) => {
        setQuery(input);
        onChange(input); 

        if (input.length > 1) {
            setLoading(true);
            try {
                const data = await searchProjects(input);
                setResults(data);
                setShowDropdown(true);
            } catch (error) {
                console.error("Error searching projects:", error);
            } finally {
                setLoading(false);
            }
        } else {
            setResults([]);
            setShowDropdown(false);
        }
    };

    const handleSelect = (project) => {
        setQuery(project.manual_project_id || project.name);
        setShowDropdown(false);
        onSelect(project);
    };

    return (
        <div className="project-search-container" ref={wrapperRef}>
            <input
                type="text"
                className={className || "form-control"}
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={placeholder || "Search Project ID..."}
                required={required}
                onFocus={onFocus}
                onBlur={onBlur}
            />
            {showDropdown && (
                <ul className="project-search-results">
                    {loading ? (
                        <li className="search-loading">Loading...</li>
                    ) : results.length > 0 ? (
                        results.map((project) => (
                            <li key={project.id || project.manual_project_id || project.name} onClick={() => handleSelect(project)}>
                                <div className="font-bold text-indigo-700">{project.manual_project_id || project.name}</div>
                                <div className="text-xs text-gray-700">{project.project_description || project.description}</div>
                                <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                                    <span>Account: <strong>{project.account || "N/A"}</strong></span>
                                    <span>• PM: <strong>{project.project_manager || "N/A"}</strong></span>
                                    <span>• Headed By: <strong>{project.program_manager || "N/A"}</strong></span>
                                </div>
                            </li>
                        ))
                    ) : (
                        <li className="no-results">No projects found</li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default ProjectSearchInput;
