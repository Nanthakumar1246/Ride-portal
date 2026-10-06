import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RecordDetailFields from "./RecordDetailFields";
import { getRecordModule, ACCENT_CLASSES } from "../config/recordModules";

/* One reusable "click the ID → see the whole record" popup, shared by the
   Risk / Issue / Dependency / Escalation / Action pages. */

export default function RecordDetailModal({ module, id, onClose }) {
  const config = getRecordModule(module);

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    if (!config || !id) {
      setError("This record cannot be opened.");
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError("");

    config
      .getById(id)
      .then((res) => {
        if (ignore) return;
        const data = res?.data || res;
        if (!data || typeof data !== "object") setError("Record not found.");
        else setRecord(data);
      })
      .catch((err) => {
        if (!ignore) setError(err?.message || "Could not load this record.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [config, id]);

  // Close on Escape, like the other modals in the app.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const heading = config?.label || "Record";
  const accent = (ACCENT_CLASSES[config?.accent] || ACCENT_CLASSES.indigo).soft;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0 ${accent}`}>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">{heading} Details</h3>
              <p className="text-[11px] font-bold mt-0.5">{id}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 text-lg font-bold leading-none"
            >
              ×
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4">
            {loading && <p className="text-xs font-semibold text-gray-500 py-6 text-center">Loading details…</p>}
            {!loading && error && <p className="text-xs font-semibold text-red-600 py-6 text-center">{error}</p>}

            {!loading && !error && (
              <>
                <RecordDetailFields record={record} />
              </>
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold uppercase tracking-wide hover:bg-gray-800 transition"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
