import React, { useState, useRef } from "react";
import { X, UploadSimple, FileXls, Trash, Lightning, Warning, CheckCircle } from "phosphor-react";
import { bulkUploadActionsApi } from "../api/actionsApi";
import * as XLSX from "xlsx";

const BulkUploadActionsModal = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // Reset all state whenever the modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFile(null);
      setParsedRows([]);
      setError("");
      setDragOver(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parseExcelDate = (val) => {
    if (!val) return null;
    let str = String(val).trim();
    if (str.toUpperCase() === "NA" || str.toUpperCase() === "TBD") return null;

    if (str.includes("\n")) str = str.split("\n")[0].trim();
    if (str.includes(",")) str = str.split(",")[0].trim();

    const numVal = Number(str);
    if (!isNaN(numVal) && typeof numVal === "number" && numVal > 10000) {
      const date = new Date(Math.round((numVal - 25569) * 86400 * 1000));
      return date.toISOString().split("T")[0];
    }

    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
      let [d, m, y] = parts;
      if (y.length === 2) y = "20" + y;
      if (d.length === 4) return `${d}-${m.padStart(2, "0")}-${y.padStart(2, "0")}`;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return null;
  };

  const getVal = (row, keys) => {
    for (const k of Object.keys(row)) {
      if (keys.map((x) => x.toLowerCase().trim()).includes(k.toLowerCase().trim())) {
        return row[k];
      }
    }
    return "";
  };

  const handleFile = async (selectedFile) => {
    setError("");
    setParsedRows([]);

    if (!selectedFile) return;

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (json.length === 0) {
        setError("The Excel file is empty. Please add data and try again.");
        return;
      }
      if (json.length > 40) {
        setError("Maximum of 40 records allowed per upload. Your file has " + json.length + " records.");
        return;
      }

      const actions = json.map((row) => ({
        action_id: getVal(row, ["action_id", "Action ID"]),
        action_item: getVal(row, ["action_item", "Action Item", "Action item"]),
        priority: getVal(row, ["priority", "Priority"]) || "Medium",
        target_date: parseExcelDate(getVal(row, ["target_date", "Target Date", "Target date"])),
        status: getVal(row, ["status", "Status"]) || "Open",
        responsible: getVal(row, ["responsible", "Responsible", "Responsib"]),
        support_required_from: getVal(row, ["support_required_from", "Support Required From", "Support required from", "Support re"]),
        teams_involved: getVal(row, ["teams_involved", "Teams Involved", "Teams involved", "Teams Inv"]),
        remarks: getVal(row, ["remarks", "Remarks"]),
      }));

      setFile(selectedFile);
      setParsedRows(actions);
    } catch (err) {
      console.error("Parse error:", err);
      setError("Failed to parse Excel file. Please check the format.");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFile(droppedFile);
  };

  const handleUpload = async () => {
    if (parsedRows.length === 0) return;
    setUploading(true);
    setError("");

    try {
      await bulkUploadActionsApi(parsedRows);
      onSuccess?.();
      handleReset();
      onClose();
    } catch (err) {
      console.error("Bulk upload error:", err);
      setError(err.message || "Failed to upload actions. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all"
        style={{ animation: "slideUp 0.3s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <UploadSimple size={20} weight="bold" className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 font-marcellus tracking-tight">Bulk Upload Actions</h2>
              <p className="text-xs text-gray-500">Upload an Excel file to add multiple action items at once</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Error Alert */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 animate-fade-in">
              <Warning size={20} weight="duotone" className="text-red-500 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Drop Zone */}
          {!file && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 p-10 text-center group ${
                dragOver
                  ? "border-indigo-400 bg-indigo-50 scale-[1.01]"
                  : "border-gray-200 bg-gray-50/50 hover:border-indigo-300 hover:bg-indigo-50/30"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <div className="flex flex-col items-center gap-3">
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${
                  dragOver ? "bg-indigo-100 scale-110" : "bg-white shadow-sm border border-gray-100 group-hover:shadow-md"
                }`}>
                  <FileXls size={28} weight="duotone" className={dragOver ? "text-indigo-600" : "text-gray-400 group-hover:text-indigo-500"} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    {dragOver ? "Drop your file here" : "Drag & drop your Excel file here"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    or <span className="text-indigo-600 font-semibold underline underline-offset-2">browse</span> to choose a file (.xlsx, .xls)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* File Info */}
          {file && (
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              <FileXls size={24} weight="duotone" className="text-indigo-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB • {parsedRows.length} records parsed</p>
              </div>
              <button
                onClick={handleReset}
                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
              >
                <Trash size={16} weight="bold" />
              </button>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Preview ({parsedRows.length} records)
                </span>
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                  <CheckCircle size={14} weight="fill" />
                  Ready to upload
                </span>
              </div>
              <div className="overflow-x-auto max-h-[240px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-gray-500">#</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-gray-500 min-w-[180px]">Action Item</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-gray-500">Priority</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-gray-500">Status</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-gray-500">Target Date</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-gray-500">Responsible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-2 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2 text-gray-800 font-medium truncate max-w-[220px]">{row.action_item || "-"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            row.priority === "Critical" ? "bg-red-100 text-red-700" :
                            row.priority === "High" ? "bg-orange-100 text-orange-700" :
                            row.priority === "Medium" ? "bg-yellow-100 text-yellow-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {row.priority}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{row.status}</td>
                        <td className="px-3 py-2 text-gray-600 font-mono text-[11px]">{row.target_date || "-"}</td>
                        <td className="px-3 py-2 text-gray-600">{row.responsible || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expected Format Guide */}
          {!file && (
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Expected Column Headers</p>
              <div className="flex flex-wrap gap-1.5">
                {["Action Item", "Priority", "Target Date", "Status", "Responsible", "Support Required From", "Teams Involved", "Remarks"].map((col) => (
                  <span key={col} className="inline-block px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-[11px] font-medium text-gray-600 shadow-sm">
                    {col}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
                Maximum 40 records per upload. Priority options: Critical, High, Medium, Low. Status options: Open, In Progress, Resolved, On Hold, Cancelled.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || parsedRows.length === 0}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all transform active:scale-95 flex items-center gap-2 ${
              uploading || parsedRows.length === 0
                ? "bg-gray-300 cursor-not-allowed shadow-none"
                : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-200"
            }`}
          >
            <Lightning size={16} weight="fill" />
            {uploading ? "Uploading..." : `Upload ${parsedRows.length || ""} Records`}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default BulkUploadActionsModal;
