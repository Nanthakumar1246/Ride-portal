import React from "react";

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  itemLabel = "entries",
  className = "",
}) => {
  const pages = Math.max(1, Number(totalPages) || 1);
  const page = Math.min(Math.max(1, Number(currentPage) || 1), pages);

  const infoText =
    totalItems != null && pageSize != null
      ? `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, totalItems)} of ${totalItems} ${itemLabel}`
      : `Page ${page} of ${pages}`;

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl mt-4 shadow-sm ${className}`}
    >
      <span className="text-xs text-slate-500 font-medium">{infoText}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={page === pages}
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Pagination;
