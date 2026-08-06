import React, { useState } from "react";
import { createProject } from "../api/projectsApi";

const AddProjectModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    account: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setFormData({ name: "", account: "", description: "" });
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createProject(formData);
      onSuccess();
      onClose();
      setFormData({ name: "", account: "", description: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-slide-up">
        <div className="flex justify-between items-center mb-6 border-b pb-3">
          <h2 className="text-xl font-bold text-gray-900 font-marcellus">Add New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Project ID *</label>
            <input
              type="text"
              required
              className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
              placeholder="e.g. SI_IMP207"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Account *</label>
            <input
              type="text"
              required
              className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
              placeholder="e.g. Finance"
              value={formData.account}
              onChange={(e) => setFormData({ ...formData, account: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Project Description</label>
            <textarea
              className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
              rows={3}
              placeholder="Brief description of the project"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-black text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Add Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProjectModal;
