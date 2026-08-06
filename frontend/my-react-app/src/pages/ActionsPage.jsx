
import React, { useEffect, useState } from "react";
import { fetchActions, fetchActionApi, updateActionApi } from "../api/actionsApi";
import { actionsFormConfig } from "../config/formConfig";

function ActionsPage() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [mode, setMode] = useState("view");
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    const idParam = params.get("id");
    setMode(modeParam || "view");
    setEditId(idParam);

    async function load() {
      try {
        setLoading(true);
        if (modeParam === "edit" && idParam) {
          const res = await fetchActionApi(idParam);
          setFormData(res.data || res);
        } else {
          const res = await fetchActions();
          setActions(res.data || []);
        }
      } catch (err) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [window.location.search]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateActionApi(editId, formData);
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        window.location.href = `${window.location.pathname}?mode=view`;
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to update action");
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (loading) return <div>Loading actions...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50 text-brandDark px-4 sm:px-6 py-4 relative">
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-2 rounded-full shadow-lg animate-fade-in">
          Saved Successfully
        </div>
      )}
      <h1 className="font-marcellus text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Actions</h1>
      {mode === "view" && (
        <>
          <div className="mb-2 text-xs text-gray-500">To update this record, click Edit</div>
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full text-left text-xs sm:text-sm font-urbanist">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 sm:px-4 py-2.5 text-[11px] sm:text-xs font-semibold text-brandMuted uppercase tracking-wide whitespace-nowrap">Edit</th>
                    <th className="px-3 sm:px-4 py-2.5 text-[11px] sm:text-xs font-semibold text-brandMuted uppercase tracking-wide whitespace-nowrap">Action ID</th>
                    <th className="px-3 sm:px-4 py-2.5 text-[11px] sm:text-xs font-semibold text-brandMuted uppercase tracking-wide whitespace-nowrap">Status</th>
                    <th className="px-3 sm:px-4 py-2.5 text-[11px] sm:text-xs font-semibold text-brandMuted uppercase tracking-wide whitespace-nowrap">Priority</th>
                    <th className="px-3 sm:px-4 py-2.5 text-[11px] sm:text-xs font-semibold text-brandMuted uppercase tracking-wide whitespace-nowrap">Action Item</th>
                    <th className="px-3 sm:px-4 py-2.5 text-[11px] sm:text-xs font-semibold text-brandMuted uppercase tracking-wide whitespace-nowrap">Target Date</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                      <td className="px-3 sm:px-4 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = `${window.location.pathname}?mode=edit&id=${a.id}`;
                          }}
                          className="inline-flex items-center justify-center rounded-full border border-brandDark/20 px-3 py-1 text-[11px] font-urbanist text-brandDark hover:bg-brandDark hover:text-white transition"
                        >
                          Edit
                        </button>
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-[11px] sm:text-sm whitespace-nowrap">{a.action_id}</td>
                      <td className="px-3 sm:px-4 py-2 text-[11px] sm:text-sm whitespace-nowrap">{a.status}</td>
                      <td className="px-3 sm:px-4 py-2 text-[11px] sm:text-sm whitespace-nowrap">{a.priority}</td>
                      <td className="px-3 sm:px-4 py-2 text-[11px] sm:text-sm whitespace-nowrap">{a.action_item}</td>
                      <td className="px-3 sm:px-4 py-2 text-[11px] sm:text-sm whitespace-nowrap">{a.target_date}</td>
                    </tr>
                  ))}
                  {actions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 sm:px-4 py-4 text-center text-xs sm:text-sm text-brandMuted">
                        No actions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {mode === "edit" && editId && (
        <div className="mt-4 rounded-xl bg-white border border-gray-200 shadow-sm p-5 max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-marcellus font-bold text-xl text-gray-900">Edit Action Item</h3>
             <button 
               onClick={() => window.location.href = `${window.location.pathname}?mode=view`}
               className="text-xs font-bold text-gray-400 hover:text-brandDark uppercase tracking-widest"
             >
               Back to list
             </button>
          </div>
          
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {actionsFormConfig.fields.map((field) => (
              <div key={field.name} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                
                {field.type === "select" ? (
                  <select
                    name={field.name}
                    required={field.required}
                    value={formData[field.name] || ""}
                    onChange={handleInputChange}
                    disabled={field.readOnly}
                    className="w-full border border-gray-200 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-brandDark/20 outline-none transition bg-gray-50/50"
                  >
                    <option value="">Select {field.label}</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    name={field.name}
                    required={field.required}
                    value={formData[field.name] || ""}
                    onChange={handleInputChange}
                    readOnly={field.readOnly}
                    rows={4}
                    className="w-full border border-gray-200 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-brandDark/20 outline-none transition bg-gray-50/50"
                  />
                ) : (
                  <input
                    type={field.type === "date" ? "date" : "text"}
                    name={field.name}
                    required={field.required}
                    value={formData[field.name] || ""}
                    onChange={handleInputChange}
                    readOnly={field.readOnly}
                    className={`w-full border border-gray-200 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-brandDark/20 outline-none transition ${field.readOnly ? "bg-gray-100 cursor-not-allowed" : "bg-gray-50/50"}`}
                  />
                )}
              </div>
            ))}
            
            <div className="md:col-span-2 flex justify-end gap-3 mt-4 border-t pt-6">
              <button
                type="button"
                onClick={() => window.location.href = `${window.location.pathname}?mode=view`}
                className="px-6 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-brandDark text-white px-8 py-2 rounded-full text-sm font-bold shadow-lg hover:bg-black transition disabled:opacity-50"
              >
                {saving ? "Saving Changes..." : "Update Action"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default ActionsPage;
