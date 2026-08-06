import React, { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Folder,
  UploadSimple,
  MagnifyingGlass,
  ArrowClockwise,
  DownloadSimple,
  CheckCircle,
  WarningCircle,
  FileXls,
  FloppyDisk,
  Rows,
} from "phosphor-react";
import {
  fetchProjectsMaster,
  fetchAccounts,
  fetchManagers,
  upsertProjectsBulk,
  fetchMappingTemplates,
  saveMappingTemplate,
} from "../api/projectsApi";
import {
  TARGET_FIELDS,
  autoDetectHeaderMapping,
  parseRowsWithMapping,
  validateProjectRows,
  downloadErrorReport,
} from "../utils/projectExcelParser";
import SuccessNotification from "../components/SuccessNotification";

const ProjectMasterPage = () => {
  const [activeTab, setActiveTab] = useState("view"); // 'view' | 'import'

  // --- VIEW PROJECTS STATE ---
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccountFilter, setSelectedAccountFilter] = useState("");
  const [selectedPmFilter, setSelectedPmFilter] = useState("");
  const [selectedPgmFilter, setSelectedPgmFilter] = useState("");

  const [accountList, setAccountList] = useState([]);
  const [pmList, setPmList] = useState([]);
  const [pgmList, setPgmList] = useState([]);

  // --- IMPORT WIZARD STATE ---
  const [importStep, setImportStep] = useState(1); // 1: Upload, 2: Mapping, 3: Preview
  const [uploadedFile, setUploadedFile] = useState(null);
  const [rawExcelHeaders, setRawExcelHeaders] = useState([]);
  const [rawExcelRows, setRawExcelRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [validationResult, setValidationResult] = useState(null);

  const [savedTemplates, setSavedTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [makeDefaultTemplate, setMakeDefaultTemplate] = useState(false);

  const [importing, setImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fileInputRef = useRef(null);

  // Load View Projects & Filters
  const loadMasterData = useCallback(async () => {
    setLoading(true);
    try {
      const [projData, accData, mgrData, tplData] = await Promise.all([
        fetchProjectsMaster({
          q: searchQuery,
          account: selectedAccountFilter,
          project_manager: selectedPmFilter,
          program_manager: selectedPgmFilter,
        }),
        fetchAccounts(),
        fetchManagers(),
        fetchMappingTemplates(),
      ]);

      setProjects(projData || []);
      setAccountList(accData || []);
      setPmList(mgrData?.project_managers || []);
      setPgmList(mgrData?.program_managers || []);
      setSavedTemplates(tplData || []);

      // Auto-apply default mapping template if available
      const defaultTpl = tplData?.find((t) => t.is_default);
      if (defaultTpl) {
        setSelectedTemplateId(defaultTpl.id);
      }
    } catch (err) {
      console.error("Failed to load project master data:", err);
      setErrorMessage("Failed to load project master data.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedAccountFilter, selectedPmFilter, selectedPgmFilter]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Handle Excel File Selection
  const handleFileSelect = async (file) => {
    if (!file) return;
    setUploadedFile(file);
    setErrorMessage("");

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      if (!jsonRows || jsonRows.length === 0) {
        setErrorMessage("The uploaded Excel file contains no data rows.");
        return;
      }

      // Extract raw header keys from first row
      const headers = Object.keys(jsonRows[0]);
      setRawExcelHeaders(headers);
      setRawExcelRows(jsonRows);

      // Auto-detect mappings or use selected template
      let initialMapping = {};
      const activeTpl = savedTemplates.find((t) => String(t.id) === String(selectedTemplateId));
      if (activeTpl && activeTpl.mapping_config) {
        initialMapping = activeTpl.mapping_config;
      } else {
        initialMapping = autoDetectHeaderMapping(headers);
      }

      setColumnMapping(initialMapping);
      setImportStep(2); // Proceed to Column Mapping Step
    } catch (err) {
      console.error("Excel parse error:", err);
      setErrorMessage("Error reading Excel file. Please ensure it is a valid .xlsx or .xls file.");
    }
  };

  // Run validation whenever mapping changes
  const handleProceedToPreview = () => {
    const parsedMappedRows = parseRowsWithMapping(rawExcelRows, columnMapping);
    const result = validateProjectRows(parsedMappedRows, projects);
    setValidationResult(result);
    setImportStep(3); // Proceed to Validation Preview Step
  };

  // Save Mapping Template
  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      setErrorMessage("Please enter a name for the mapping template.");
      return;
    }

    try {
      const created = await saveMappingTemplate({
        template_name: newTemplateName.trim(),
        mapping_config: columnMapping,
        is_default: makeDefaultTemplate,
      });
      setSuccessMessage(`Mapping template "${created.template_name}" saved successfully!`);
      const updatedTpls = await fetchMappingTemplates();
      setSavedTemplates(updatedTpls);
      setSelectedTemplateId(created.id);
      setNewTemplateName("");
    } catch (err) {
      console.error("Error saving template:", err);
      setErrorMessage("Failed to save mapping template.");
    }
  };

  // Execute Bulk Upsert Import
  const handleConfirmImport = async () => {
    if (!validationResult || validationResult.validRows.length === 0) {
      setErrorMessage("No valid project rows available for import.");
      return;
    }

    setImporting(true);
    setErrorMessage("");

    try {
      const payload = validationResult.validRows.map((r) => r.data);
      const response = await upsertProjectsBulk(payload);

      setSuccessMessage(response.message || "Projects imported successfully!");
      await loadMasterData();

      // Reset import wizard
      setImportStep(1);
      setUploadedFile(null);
      setRawExcelRows([]);
      setValidationResult(null);
      setActiveTab("view");
    } catch (err) {
      console.error("Import error:", err);
      setErrorMessage(err.response?.data?.message || "Project import failed.");
    } finally {
      setImporting(false);
    }
  };

  // Export Current Master List to Excel
  const handleExportMaster = () => {
    if (projects.length === 0) return;
    const exportData = projects.map((p) => ({
      "SO Number": p.so_number || "",
      "Project ID": p.manual_project_id || p.name || "",
      "Project Description": p.project_description || "",
      Account: p.account || "",
      "Project Manager (PM)": p.project_manager || "",
      "Program Manager (Headed By)": p.program_manager || "",
      "Scope Description": p.scope_description || "",
      Status: p.status || "Active",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Project Master");
    XLSX.writeFile(wb, `RIDE_Project_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notification */}
      {successMessage && (
        <SuccessNotification message={successMessage} onClose={() => setSuccessMessage("")} />
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl text-slate-900 shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-inner">
            <Folder size={32} weight="duotone" className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-marcellus text-slate-900">Project Master Management</h1>
            <p className="text-xs text-slate-500 mt-1">
              Centralized Single Source of Truth for Enterprise Project Master Data across RIDE
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          <button
            onClick={() => setActiveTab("view")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "view"
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Rows size={16} weight="bold" />
            View Projects ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "import"
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <UploadSimple size={16} weight="bold" />
            Import Projects
          </button>
        </div>
      </div>

      {/* ERROR ALERT */}
      {errorMessage && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <WarningCircle size={20} weight="duotone" className="text-red-500 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage("")} className="text-xs font-bold text-red-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ================= TAB 1: VIEW PROJECTS ================= */}
      {activeTab === "view" && (
        <div className="space-y-6 animate-fade-in">
          {/* Search & Filter Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <MagnifyingGlass size={18} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Project ID, Description, SO..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Account Filter */}
              <div className="relative">
                <select
                  value={selectedAccountFilter}
                  onChange={(e) => setSelectedAccountFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
                >
                  <option value="">All Accounts ({accountList.length})</option>
                  {accountList.map((acc) => (
                    <option key={acc} value={acc}>
                      {acc}
                    </option>
                  ))}
                </select>
              </div>

              {/* PM Filter */}
              <div className="relative">
                <select
                  value={selectedPmFilter}
                  onChange={(e) => setSelectedPmFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
                >
                  <option value="">All Project Managers (PM)</option>
                  {pmList.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>

              {/* Program Manager Filter */}
              <div className="relative">
                <select
                  value={selectedPgmFilter}
                  onChange={(e) => setSelectedPgmFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
                >
                  <option value="">All Program Managers (Headed By)</option>
                  {pgmList.map((pgm) => (
                    <option key={pgm} value={pgm}>
                      {pgm}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">
                Showing <strong className="text-slate-900">{projects.length}</strong> master records
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={loadMasterData}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-all"
                >
                  <ArrowClockwise size={14} /> Refresh
                </button>
                <button
                  onClick={handleExportMaster}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-semibold transition-all"
                >
                  <DownloadSimple size={14} /> Export Excel
                </button>
              </div>
            </div>
          </div>

          {/* Master Grid Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
                    <th className="px-4 py-3">SO Number</th>
                    <th className="px-4 py-3">Project ID</th>
                    <th className="px-4 py-3">Project Description</th>
                    <th className="px-4 py-3">Account / Client</th>
                    <th className="px-4 py-3">PM</th>
                    <th className="px-4 py-3">Program Manager</th>
                    <th className="px-4 py-3">Scope / Description</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400 font-medium">
                        Loading Project Master Records...
                      </td>
                    </tr>
                  ) : projects.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-12 text-center text-slate-400">
                        <Folder size={40} className="mx-auto mb-2 opacity-30" />
                        No project master records found.
                      </td>
                    </tr>
                  ) : (
                    projects.map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-slate-700">{p.so_number || "—"}</td>
                        <td className="px-4 py-2.5 font-bold text-indigo-600">{p.manual_project_id || p.name}</td>
                        <td className="px-4 py-2.5 text-slate-800 max-w-[200px] truncate" title={p.project_description}>
                          {p.project_description || "—"}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-700 max-w-[180px] truncate" title={p.account}>
                          {p.account || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{p.project_manager || "—"}</td>
                        <td className="px-4 py-2.5 text-purple-700 font-medium">{p.program_manager || "—"}</td>
                        <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate" title={p.scope_description}>
                          {p.scope_description || "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle size={10} weight="fill" /> Active
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: IMPORT PROJECTS ================= */}
      {activeTab === "import" && (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
          {/* Import Wizard Progress Header */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span
                className={`h-7 w-7 rounded-full flex items-center justify-center font-bold ${
                  importStep >= 1 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                }`}
              >
                1
              </span>
              <span className={`font-semibold ${importStep === 1 ? "text-indigo-600" : "text-slate-600"}`}>
                Upload Excel
              </span>
            </div>
            <div className="h-0.5 w-12 bg-slate-200" />
            <div className="flex items-center gap-3">
              <span
                className={`h-7 w-7 rounded-full flex items-center justify-center font-bold ${
                  importStep >= 2 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                }`}
              >
                2
              </span>
              <span className={`font-semibold ${importStep === 2 ? "text-indigo-600" : "text-slate-600"}`}>
                Dynamic Mapping
              </span>
            </div>
            <div className="h-0.5 w-12 bg-slate-200" />
            <div className="flex items-center gap-3">
              <span
                className={`h-7 w-7 rounded-full flex items-center justify-center font-bold ${
                  importStep >= 3 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                }`}
              >
                3
              </span>
              <span className={`font-semibold ${importStep === 3 ? "text-indigo-600" : "text-slate-600"}`}>
                Validation Preview & Upsert
              </span>
            </div>
          </div>

          {/* STEP 1: UPLOAD EXCEL */}
          {importStep === 1 && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 text-center">
              <div className="max-w-md mx-auto space-y-2">
                <h2 className="text-lg font-bold text-slate-800">Upload Project Master Excel File</h2>
                <p className="text-xs text-slate-500">
                  Upload an Excel spreadsheet containing SO Number, Project ID, Description, PM, Headed By, and Account.
                </p>
              </div>

              {/* Template Select Dropdown */}
              {savedTemplates.length > 0 && (
                <div className="max-w-md mx-auto text-left space-y-1">
                  <label className="text-xs font-bold text-slate-700">Pre-select Saved Mapping Template:</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="">-- Auto-Detect Header Aliases --</option>
                    {savedTemplates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.template_name} {tpl.is_default ? "(Default)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/60 p-10 rounded-2xl cursor-pointer transition-all space-y-3 group max-w-xl mx-auto"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                  }}
                />
                <div className="h-14 w-14 rounded-2xl bg-white shadow-md border border-indigo-100 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <FileXls size={32} weight="duotone" className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-indigo-900">Click to browse or drag & drop Excel file</p>
                  <p className="text-[11px] text-slate-400 mt-1">Supports .xlsx and .xls formats</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DYNAMIC COLUMN MAPPING */}
          {importStep === 2 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Dynamic Column Mapping</h2>
                  <p className="text-xs text-slate-500">
                    Verify and map Excel columns from <strong className="text-indigo-600">{uploadedFile?.name || "Excel File"}</strong> to RIDE fields:
                  </p>
                </div>

                <button
                  onClick={() => setImportStep(1)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Change File
                </button>
              </div>

              {/* Mapping Dropdowns Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TARGET_FIELDS.map((field) => (
                  <div key={field.key} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </span>
                      <span className="text-[10px] text-slate-400">Target Field</span>
                    </div>

                    <select
                      value={columnMapping[field.key] || ""}
                      onChange={(e) =>
                        setColumnMapping({ ...columnMapping, [field.key]: e.target.value })
                      }
                      className={`w-full p-2 text-xs border rounded-xl bg-white ${
                        field.required && !columnMapping[field.key]
                          ? "border-red-300 ring-1 ring-red-200 text-red-600"
                          : "border-slate-200 text-slate-800"
                      }`}
                    >
                      <option value="">-- Ignore / Not Mapped --</option>
                      {rawExcelHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Save Mapping Template Bar */}
              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <FloppyDisk size={18} className="text-indigo-600 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Template Name (e.g. Finance Format)..."
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg w-full sm:w-64"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={makeDefaultTemplate}
                      onChange={(e) => setMakeDefaultTemplate(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    Set as Default
                  </label>

                  <button
                    onClick={handleSaveTemplate}
                    className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all"
                  >
                    Save Template
                  </button>
                </div>
              </div>

              {/* Step 2 Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setImportStep(1)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Back
                </button>
                <button
                  onClick={handleProceedToPreview}
                  className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold rounded-xl hover:opacity-90 shadow-md transition-all"
                >
                  Proceed to Validation & Preview
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: VALIDATION PREVIEW & UPSERT CONFIRM */}
          {importStep === 3 && validationResult && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Pre-Import Validation & Preview</h2>
                  <p className="text-xs text-slate-500">
                    Review validation counts and errors before saving to Project Master:
                  </p>
                </div>

                {validationResult.erroredRows.length > 0 && (
                  <button
                    onClick={() => downloadErrorReport(validationResult.erroredRows)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-all"
                  >
                    <DownloadSimple size={14} /> Download Error Report ({validationResult.erroredRows.length})
                  </button>
                )}
              </div>

              {/* Metric Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Rows</span>
                  <p className="text-xl font-extrabold text-slate-800">{validationResult.totalRows}</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">New Projects</span>
                  <p className="text-xl font-extrabold text-emerald-700">{validationResult.newCount}</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                  <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Updated (Upsert)</span>
                  <p className="text-xl font-extrabold text-amber-700">{validationResult.updatedCount}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Skipped</span>
                  <p className="text-xl font-extrabold text-slate-600">{validationResult.skippedCount}</p>
                </div>
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl">
                  <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Failed / Errors</span>
                  <p className="text-xl font-extrabold text-red-700">{validationResult.failedCount}</p>
                </div>
              </div>

              {/* Rows Data Preview */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 font-bold text-slate-600 z-10">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">SO Number</th>
                      <th className="p-2.5">Project ID</th>
                      <th className="p-2.5">Project Description</th>
                      <th className="p-2.5">Account</th>
                      <th className="p-2.5">PM</th>
                      <th className="p-2.5">Program Manager</th>
                      <th className="p-2.5">Scope/Description</th>
                      <th className="p-2.5 min-w-[200px]">Validation Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationResult.allRows.map((r) => (
                      <tr key={r.rowIndex} className={!r.isValid ? "bg-red-50/40" : ""}>
                        <td className="p-2.5 font-bold text-slate-500">{r.rowIndex}</td>
                        <td className="p-2.5">
                          {r.status === "NEW" && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-md">
                              NEW
                            </span>
                          )}
                          {r.status === "UPDATED" && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-md">
                              UPDATE
                            </span>
                          )}
                          {r.status === "FAILED" && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold text-[10px] rounded-md">
                              FAILED
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-700">{r.data.so_number || "—"}</td>
                        <td className="p-2.5 font-bold text-indigo-600">{r.data.manual_project_id || "—"}</td>
                        <td className="p-2.5 text-slate-700 truncate max-w-[150px]" title={r.data.project_description}>{r.data.project_description || "—"}</td>
                        <td className="p-2.5 text-slate-700">{r.data.account || "—"}</td>
                        <td className="p-2.5 text-slate-700">{r.data.project_manager || "—"}</td>
                        <td className="p-2.5 text-purple-700 font-medium">{r.data.program_manager || "—"}</td>
                        <td className="p-2.5 text-slate-700 truncate max-w-[150px]" title={r.data.scope_description}>{r.data.scope_description || "—"}</td>
                        <td className="p-2.5 text-[11px] text-red-600 whitespace-normal">
                          {r.errors.length > 0 ? r.errors.join("; ") : "Ready to import"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setImportStep(2)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Back to Mapping
                </button>

                <button
                  onClick={handleConfirmImport}
                  disabled={importing || validationResult.validRows.length === 0}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
                >
                  {importing
                    ? "Importing Projects..."
                    : `Confirm & Upsert ${validationResult.validRows.length} Valid Projects`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectMasterPage;
