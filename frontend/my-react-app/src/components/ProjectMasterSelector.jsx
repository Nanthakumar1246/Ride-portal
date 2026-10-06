import React, { useState, useEffect } from "react";
import { fetchAccounts, fetchProjectsByAccount, fetchManagers } from "../api/projectsApi";
import { Folder, CheckCircle, User, Briefcase, Hash } from "phosphor-react";

const ProjectMasterSelector = ({
  selectedAccount = "",
  selectedProjectId = "",
  onProjectChange,
  required = true,
  className = "",
}) => {
  const [accounts, setAccounts] = useState([]);
  const [accountProjects, setAccountProjects] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [managers, setManagers] = useState({ project_managers: [], program_managers: [] });

  const [activeAccount, setActiveAccount] = useState(selectedAccount || "");
  const [activeProjectId, setActiveProjectId] = useState(selectedProjectId || "");
  const [selectedProjectDetails, setSelectedProjectDetails] = useState(null);

  // Sync state if parent props change
  useEffect(() => {
    if (selectedAccount && selectedAccount !== activeAccount) {
      setActiveAccount(selectedAccount);
    }
    if (selectedProjectId && selectedProjectId !== activeProjectId) {
      setActiveProjectId(selectedProjectId);
    }
  }, [selectedAccount, selectedProjectId]);

  // Load account dropdown options
  useEffect(() => {
    const loadAccountList = async () => {
      setLoadingAccounts(true);
      try {
        const accs = await fetchAccounts();
        setAccounts(accs || []);
      } catch (err) {
        console.error("Failed to load accounts for ProjectMasterSelector:", err);
      } finally {
        setLoadingAccounts(false);
      }
    };
    loadAccountList();

    const loadManagersList = async () => {
      try {
        const mgrs = await fetchManagers();
        setManagers(mgrs || { project_managers: [], program_managers: [] });
      } catch (err) {
        console.error("Failed to load managers:", err);
      }
    };
    loadManagersList();
  }, []);

  // Fetch projects when Account changes
  useEffect(() => {
    if (!activeAccount) {
      setAccountProjects([]);
      setSelectedProjectDetails(null);
      return;
    }

    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const projs = await fetchProjectsByAccount(activeAccount);
        setAccountProjects(projs || []);

        // If activeProjectId is present, find match
        if (activeProjectId) {
          const match = projs.find(
            (p) => (p.manual_project_id || p.name || "").toLowerCase() === activeProjectId.toLowerCase()
          );
          if (match) {
            setSelectedProjectDetails(match);
          }
        }
      } catch (err) {
        console.error("Failed to load projects for account:", err);
      } finally {
        setLoadingProjects(false);
      }
    };

    loadProjects();
  }, [activeAccount]);

  // Handle Account Selection
  const handleAccountSelect = (acc) => {
    setActiveAccount(acc);
    setActiveProjectId("");
    setSelectedProjectDetails(null);

    onProjectChange?.({
      account: acc,
      manual_project_id: "",
      project_description: "",
      project_manager: "",
      program_manager: "",
      so_number: "",
    });
  };

  // Handle Project Selection
  const handleProjectSelect = (pId) => {
    setActiveProjectId(pId);
    const match = accountProjects.find(
      (p) => (p.manual_project_id || p.name || "").toLowerCase() === pId.toLowerCase()
    );

    setSelectedProjectDetails(match || null);

    onProjectChange?.({
      account: activeAccount,
      manual_project_id: match ? match.manual_project_id || match.name : pId,
      project_description: match ? match.project_description || match.description || "" : "",
      project_manager: match ? match.project_manager || "" : "",
      program_manager: match ? match.program_manager || "" : "",
      so_number: match ? match.so_number || "" : "",
    });
  };

  const handleManagerChange = (field, value) => {
    if (!selectedProjectDetails) return;
    const updatedDetails = { ...selectedProjectDetails, [field]: value };
    setSelectedProjectDetails(updatedDetails);

    onProjectChange?.({
      account: activeAccount,
      manual_project_id: updatedDetails.manual_project_id || updatedDetails.name || activeProjectId,
      project_description: updatedDetails.project_description || updatedDetails.description || "",
      project_manager: updatedDetails.project_manager || "",
      program_manager: updatedDetails.program_manager || "",
      so_number: updatedDetails.so_number || "",
    });
  };

  return (
    <div className={`space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-200 pb-2">
        <Folder size={16} className="text-indigo-600" />
        <span>Project Master Selection</span>
        <span className="text-[10px] font-normal text-slate-400 ml-auto">(Single Source of Truth)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Step 1: Select Account */}
        <div className="space-y-1">
          <label className="font-bold text-slate-700">
            1. Select Account {required && <span className="text-red-500">*</span>}
          </label>
          <select
            value={activeAccount}
            onChange={(e) => handleAccountSelect(e.target.value)}
            required={required}
            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium"
          >
            <option value="">{loadingAccounts ? "Loading Accounts..." : "-- Select Account --"}</option>
            {accounts.map((acc) => (
              <option key={acc} value={acc}>
                {acc}
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Select Project */}
        <div className="space-y-1">
          <label className="font-bold text-slate-700">
            2. Select Project {required && <span className="text-red-500">*</span>}
          </label>
          <select
            value={activeProjectId}
            onChange={(e) => handleProjectSelect(e.target.value)}
            disabled={!activeAccount || loadingProjects}
            required={required}
            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium disabled:opacity-50"
          >
            <option value="">
              {!activeAccount
                ? "-- Select Account First --"
                : loadingProjects
                ? "Loading Projects..."
                : "-- Select Project --"}
            </option>
            {accountProjects.map((p) => {
              const pId = p.manual_project_id || p.name;
              return (
                <option key={p.id || pId} value={pId}>
                  {pId} - {p.project_description || p.description || "No description"}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Auto-Populated Read-Only Project Master Info */}
      {selectedProjectDetails && (
        <div className="p-3 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-100 rounded-xl text-xs space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-900 flex items-center gap-1.5">
              <CheckCircle size={14} weight="fill" className="text-emerald-500" />
              Project Details (Auto-Populated & Editable)
            </span>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
              Editable Details
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] pt-1">
            <div className="bg-white/80 p-2 rounded-lg border border-indigo-100/60">
              <span className="text-slate-400 block text-[10px]">SO Number</span>
              <strong className="text-slate-800">{selectedProjectDetails.so_number || "—"}</strong>
            </div>

            
            <div className="bg-white/80 p-2 rounded-lg border border-indigo-100/60">
              <span className="text-slate-400 block text-[10px] mb-1">Project Manager (PM)</span>
              <select 
                value={selectedProjectDetails.project_manager || ""}
                onChange={(e) => handleManagerChange("project_manager", e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-800 font-bold text-[11px] focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">-- Select PM --</option>
                {Array.from(new Set([...(managers.project_managers || []), selectedProjectDetails.project_manager].filter(Boolean))).map(pm => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </select>
            </div>

            <div className="bg-white/80 p-2 rounded-lg border border-indigo-100/60">
              <span className="text-slate-400 block text-[10px] mb-1">Project Manager (Headed By)</span>
              <select 
                value={selectedProjectDetails.program_manager || ""}
                onChange={(e) => handleManagerChange("program_manager", e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-purple-700 font-bold text-[11px] focus:ring-1 focus:ring-purple-500 focus:outline-none"
              >
                <option value="">-- Select Prog. Manager --</option>
                {Array.from(new Set([...(managers.program_managers || []), selectedProjectDetails.program_manager].filter(Boolean))).map(pm => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectMasterSelector;
