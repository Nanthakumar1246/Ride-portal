import React, { useEffect, useState } from "react";
import { fetchProjectHistory } from "../api/projectsApi";
import { formatDateOnly } from "../utils/dateFormat";

const ProjectHistoryModal = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchProjectHistory()
        .then(setHistory)
        .catch(err => console.error("Failed to load history", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 animate-slide-up max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-6 border-b pb-3">
          <h2 className="text-xl font-bold text-gray-900 font-marcellus">Project History Log</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="p-10 text-center text-gray-500">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No project history found.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-bold text-gray-600 uppercase text-xs">Project ID</th>
                  <th className="px-4 py-3 font-bold text-gray-600 uppercase text-xs">Account</th>
                  <th className="px-4 py-3 font-bold text-gray-600 uppercase text-xs">Description</th>
                  <th className="px-4 py-3 font-bold text-gray-600 uppercase text-xs">Added By</th>
                  <th className="px-4 py-3 font-bold text-gray-600 uppercase text-xs">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600">{item.account}</td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{item.description || "-"}</td>
                    <td className="px-4 py-3 text-blue-600 font-medium">{item.created_by}</td>
                    <td className="px-4 py-3 text-gray-500">
                        {new Date(item.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="pt-6 border-t mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-black text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectHistoryModal;
