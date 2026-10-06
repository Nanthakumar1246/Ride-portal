import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowLeft, FiSave, FiList } from "react-icons/fi";
import SearchableSelect from "../components/SearchableSelect";
import RecordDetailFields from "../components/RecordDetailFields";
import { useAuth } from "../context/AuthContext";
import { withAttachment } from "../utils/withAttachment";
import {
  getRecordModule,
  defaultStatusPayload,
  ALLOWED_STATUSES,
  PROOF_STATUSES,
  ACCENT_CLASSES,
} from "../config/recordModules";

/**
 * Status update workspace for one module (Risk / Issue / Dependency /
 * Escalation / Action).
 *
 * Pick a record by its ID, read the whole record, then move its status —
 * with remarks and an attachment where the new status requires evidence.
 * Reached at /monitoring/<module>/update, optionally with ?id=<record id>
 * to open straight onto a record.
 */
const ModuleStatusUpdatePage = ({ moduleKey }) => {
  const config = getRecordModule(moduleKey);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();

  const [rows, setRows] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  const [record, setRecord] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [recordError, setRecordError] = useState("");

  const [status, setStatus] = useState("Open");
  const [remarks, setRemarks] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState("");
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const proofRequired = PROOF_STATUSES.includes(status);
  const accent = ACCENT_CLASSES[config?.accent] || ACCENT_CLASSES.indigo;

  /* ── the pick list ── */
  const loadList = useCallback(async () => {
    if (!config) return;
    try {
      setLoadingList(true);
      const res = await config.list({});
      setRows(Array.isArray(res) ? res : res?.data || []);
    } catch (err) {
      console.error(`Could not load ${config.plural}`, err);
      setRows([]);
    } finally {
      setLoadingList(false);
    }
  }, [config]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Arriving with ?id=… opens that record straight away.
  useEffect(() => {
    const wanted = new URLSearchParams(search).get("id");
    if (wanted) setSelectedId(wanted);
  }, [search]);

  /* ── the selected record ── */
  useEffect(() => {
    let ignore = false;
    if (!config || !selectedId) {
      setRecord(null);
      setRecordError("");
      return undefined;
    }

    setLoadingRecord(true);
    setRecordError("");

    config
      .getById(selectedId)
      .then((res) => {
        if (ignore) return;
        const data = res?.data || res;
        if (!data || typeof data !== "object") {
          setRecordError("That record could not be found.");
          setRecord(null);
        } else {
          setRecord(data);
          setStatus(data.status || data.current_status || "Open");
        }
      })
      .catch((err) => {
        if (!ignore) {
          setRecordError(err?.message || "Could not load that record.");
          setRecord(null);
        }
      })
      .finally(() => {
        if (!ignore) setLoadingRecord(false);
      });

    return () => {
      ignore = true;
    };
  }, [config, selectedId]);

  if (!config) {
    return <div className="p-10 text-center text-sm font-bold text-slate-500">Unknown module.</div>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!record) {
      showToast("Select a record first");
      return;
    }

    if (proofRequired) {
      if (!remarks.trim()) {
        showToast(`Remarks are required to set status to ${status}`);
        return;
      }
      if (!attachment) {
        showToast(`An attachment is required to set status to ${status}`);
        return;
      }
    }

    try {
      setSaving(true);
      const build = config.buildStatusPayload || defaultStatusPayload;
      const payload = build({ status, remarks, user });
      await config.update(record.id, withAttachment(payload, attachment));

      showToast(`✅ ${config.label} status updated to ${status}`);
      setRemarks("");
      setAttachment(null);

      // Re-read so the details panel reflects what was just saved.
      const fresh = await config.getById(selectedId);
      const data = fresh?.data || fresh;
      if (data && typeof data === "object") setRecord(data);
      loadList();
    } catch (err) {
      console.error("Status update failed", err);
      showToast(`❌ ${err?.message || "Could not update the status"}`);
    } finally {
      setSaving(false);
    }
  };

  const currentStatus = record?.status || record?.current_status || "—";

  return (
    <motion.div
      className="min-h-[calc(100vh-80px)] flex flex-col gap-3.5 bg-slate-50/50 px-2.5 sm:px-4 py-3 font-urbanist"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {toast && (
        <div className="fixed top-4 right-1/2 translate-x-1/2 z-50 rounded-lg bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(config.route)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black text-slate-600 hover:bg-slate-100 transition"
          >
            <FiArrowLeft size={15} />
            Back
          </button>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Update {config.label} Status
          </h1>
        </div>

        <button
          type="button"
          onClick={() => navigate(config.route)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
        >
          <FiList size={15} />
          All {config.plural}
        </button>
      </div>

      {/* Record picker */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
        <label className="block text-xs font-bold text-gray-700 mb-1.5">
          Select {config.label} ID
        </label>
        <SearchableSelect
          value={selectedId}
          onChange={setSelectedId}
          disabled={loadingList}
          emptyLabel={loadingList ? "Loading…" : `[ Select ${config.label} ID ]`}
          placeholder={`Type to search ${config.label} ID…`}
          options={rows.map((r) => ({
            value: config.idOf(r),
            label: `${config.idOf(r)} — ${r.account || "Account"} (${r.status || r.current_status || "Open"})`,
            sublabel: config.titleOf(r) || r.account,
          }))}
        />
        {!loadingList && rows.length === 0 && (
          <p className="mt-2 text-[11px] font-semibold text-slate-500">
            There are no {config.plural.toLowerCase()} available to update.
          </p>
        )}
      </div>

      {!selectedId && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm font-bold text-slate-500">
            Select a {config.label} ID above to see its full details and update its status.
          </p>
        </div>
      )}

      {selectedId && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3.5 items-start">
          {/* Full record */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className={`px-5 py-3 border-b border-gray-100 ${accent.soft}`}>
              <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">
                {config.label} Details
              </h3>
              <p className="text-[11px] font-bold mt-0.5">{selectedId}</p>
            </div>

            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              {loadingRecord && (
                <p className="text-xs font-semibold text-gray-500 py-6 text-center">Loading details…</p>
              )}
              {!loadingRecord && recordError && (
                <p className="text-xs font-semibold text-red-600 py-6 text-center">{recordError}</p>
              )}
              {!loadingRecord && !recordError && <RecordDetailFields record={record} />}
            </div>
          </div>

          {/* Status form */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-xs p-5">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2.5">
              Update Status
            </h3>

            <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                Current Status
              </span>
              <span className="text-sm font-bold text-gray-800">{currentStatus}</span>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">New Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALLOWED_STATUSES.map((st) => (
                    <label
                      key={st}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-bold transition-all ${
                        status === st
                          ? "border-indigo-600 bg-indigo-50 text-indigo-800 shadow-xs"
                          : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name="newStatus"
                        value={st}
                        checked={status === st}
                        onChange={(e) => setStatus(e.target.value)}
                        className="accent-indigo-600"
                      />
                      {st}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Remarks{proofRequired && <span className="text-red-600"> *</span>}
                </label>
                <textarea
                  rows={4}
                  placeholder="What changed? Add a short update..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  required={proofRequired}
                  className="w-full rounded-lg border border-gray-300 p-3 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              {proofRequired && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Attachment <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs outline-none focus:border-indigo-500"
                  />
                  <p className="mt-1 text-[11px] font-semibold text-gray-500">
                    Required when closing or holding a log.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving || !record}
                className={`w-full py-2.5 rounded-lg text-white font-extrabold text-xs transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${accent.solid}`}
              >
                <FiSave size={14} />
                {saving ? "Saving…" : "Update Status"}
              </button>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ModuleStatusUpdatePage;
