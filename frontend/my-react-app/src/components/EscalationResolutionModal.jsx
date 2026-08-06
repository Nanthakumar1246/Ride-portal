
import React, { useState } from "react";
import { resolveEscalationApi } from "../api/escalationsApi";
import { UploadSimple, FilePdf, X } from "phosphor-react";

const EscalationResolutionModal = ({ isOpen, onClose, escalationId, onSuccess }) => {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selected = Array.from(e.target.files);
        if (files.length + selected.length > 3) {
            setError("Maximum 3 files allowed.");
            return;
        }
        setFiles((prev) => [...prev, ...selected]);
        setError(null);
    };

    const removeFile = (index) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (files.length === 0) {
            setError("Please upload at least one document to proceed.");
            return;
        }

        try {
            setUploading(true);
            setError(null);
            const formData = new FormData();
            formData.append("status", "Resolved");
            files.forEach((file) => {
                formData.append("documents", file);
            });

            await resolveEscalationApi(escalationId, formData);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.message || "Failed to upload documents.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
                { }
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 font-montserrat">Resolution Approval</h3>
                        <p className="text-xs text-gray-500 font-urbanist">Upload supporting documents to resolve this escalation.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                { }
                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
                        <p className="font-bold mb-1">Mandatory Requirement</p>
                        Please upload **proof of resolution** (Max 3 files).
                        Supported: PDF, Images (PNG/JPG), Excel, CSV, .msg.
                    </div>

                    { }
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors relative">
                        <input
                            type="file"
                            multiple
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.msg"
                        />
                        <div className="flex flex-col items-center gap-2 pointer-events-none">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                <UploadSimple size={24} weight="bold" />
                            </div>
                            <span className="text-sm font-bold text-gray-600">Click to upload documents</span>
                            <span className="text-xs text-gray-400">PDF, Images, Excel, CSV, .msg (Max 3)</span>
                        </div>
                    </div>

                    { }
                    {files.length > 0 && (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {files.map((f, i) => (
                                <div key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <FilePdf size={20} className="text-red-500" /> { }
                                        <span className="text-xs font-medium text-gray-700 truncate max-w-[200px]">{f.name}</span>
                                    </div>
                                    <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {error && <div className="text-xs text-red-500 font-bold text-center bg-red-50 p-2 rounded">{error}</div>}
                </div>

                { }
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={uploading || files.length === 0}
                        className={`px-6 py-2 rounded-lg text-sm font-bold text-white shadow-lg transition-transform active:scale-95 ${uploading || files.length === 0
                            ? "bg-gray-300 cursor-not-allowed shadow-none"
                            : "bg-blue-600 hover:bg-blue-700"
                            }`}
                    >
                        {uploading ? "Submitting..." : "Submit for Approval"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EscalationResolutionModal;
