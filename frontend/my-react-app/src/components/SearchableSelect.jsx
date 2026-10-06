import React, { useState, useEffect, useRef, useMemo } from "react";

/**
 * A type-to-filter dropdown for long option lists (e.g. picking one record
 * by ID out of hundreds). Filters client-side against the already-loaded
 * `options` — no network calls.
 *
 * options: [{ value, label, sublabel? }]
 */
const SearchableSelect = ({
  options = [],
  value,
  onChange,
  placeholder = "Search…",
  emptyLabel = "[ Select ]",
  className = "",
  disabled = false,
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) {
      setQuery(selected ? selected.label : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(selected ? selected.label : "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || (selected && q === selected.label.toLowerCase())) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  }, [query, options, selected]);

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        disabled={disabled}
        value={open ? query : (selected ? selected.label : "")}
        placeholder={selected ? selected.label : placeholder}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        className={className || "w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist focus:ring-2 focus:ring-indigo-500 outline-none"}
      />
      {open && (
        <ul className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg text-xs">
          <li
            className="px-3 py-2 text-gray-400 italic cursor-pointer hover:bg-gray-50"
            onMouseDown={() => { onChange(""); setOpen(false); setQuery(""); }}
          >
            {emptyLabel}
          </li>
          {filtered.length > 0 ? (
            filtered.map((o) => (
              <li
                key={o.value}
                className={`px-3 py-2 cursor-pointer hover:bg-indigo-50 ${o.value === value ? "bg-indigo-50 font-bold text-indigo-700" : "text-gray-700"}`}
                onMouseDown={() => { onChange(o.value); setOpen(false); setQuery(o.label); }}
              >
                {o.label}
                {o.sublabel && <div className="text-[10px] text-gray-400 font-normal">{o.sublabel}</div>}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-gray-400 italic">No matches found</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchableSelect;
