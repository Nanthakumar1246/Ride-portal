

export const TARGET_FIELDS = [
  { key: "so_number", label: "SO Number", required: false, aliases: ["SO", "SO Number", "Sales Order", "SO_No", "SO ID"] },
  { key: "manual_project_id", label: "Project ID", required: true, aliases: ["Project ID", "ProjectID", "Proj ID", "manual_project_id", "SO/Project ID"] },
  { key: "project_description", label: "Project Description", required: true, aliases: ["Project Description", "Proj Desc", "Project Name", "Project_Description"] },
  { key: "project_manager", label: "Project Manager (PM)", required: true, aliases: ["PM", "Project Manager", "PM Name", "Project_Manager"] },
  { key: "program_manager", label: "Program Manager (Headed By)", required: true, aliases: ["Headed By", "HeadedBy", "Program Manager", "PM Head", "Head", "program_manager"] },
  { key: "scope_description", label: "Scope / Description", required: false, aliases: ["Description", "Scope", "Scope of Work", "Work Description", "Details"] },
  { key: "account", label: "Account / Customer", required: true, aliases: ["Account", "Customer", "Client", "Account Name", "Customer Name"] },
];

/**
  Auto-detect header mapping based on excel header strings
 */
export const autoDetectHeaderMapping = (excelHeaders) => {
  const mapping = {};
  const assignedHeaders = new Set();

  TARGET_FIELDS.forEach((field) => {
    // 1. Try exact matches first
    let match = excelHeaders.find((header) => {
      if (assignedHeaders.has(header)) return false;
      const hNorm = header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      return field.aliases.some((alias) => {
        const aNorm = alias.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        return hNorm === aNorm;
      });
    });

    // 2. Try partial matches if no exact match found
    if (!match) {
      match = excelHeaders.find((header) => {
        if (assignedHeaders.has(header)) return false;
        const hNorm = header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        return field.aliases.some((alias) => {
          const aNorm = alias.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
          return hNorm.includes(aNorm) || (aNorm.includes(hNorm) && hNorm.length > 3);
        });
      });
    }

    if (match) {
      mapping[field.key] = match;
      assignedHeaders.add(match);
    } else {
      mapping[field.key] = "";
    }
  });

  return mapping;
};

/**
  Parse raw XLSX file rows using mapping
 */
export const parseRowsWithMapping = (rawRows, mapping) => {
  return rawRows.map((row) => {
    const mappedRow = {};
    TARGET_FIELDS.forEach((field) => {
      const headerKey = mapping[field.key];
      const rawVal = headerKey && row[headerKey] !== undefined ? row[headerKey] : "";
      mappedRow[field.key] = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : "";
    });
    return mappedRow;
  });
};

/**
  Validate mapped rows before import
 */
export const validateProjectRows = (mappedRows, existingProjects = []) => {
  const existingSet = new Set(
    existingProjects.map((p) => (p.manual_project_id || p.name || "").trim().toLowerCase()).filter(Boolean)
  );

  const seenInFile = new Set();
  const validatedRows = [];

  let newCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  mappedRows.forEach((row, index) => {
    const rowNum = index + 1;
    const errors = [];

    // Required fields check
    if (!row.manual_project_id) errors.push("Missing Project ID");
    if (!row.account) errors.push("Missing Account Name");
    if (!row.project_description) errors.push("Missing Project Description");
    if (!row.project_manager) errors.push("Missing Project Manager (PM)");
    if (!row.program_manager) errors.push("Missing Program Manager (Headed By)");

    const pIdLower = (row.manual_project_id || "").toLowerCase();

    // In-file duplicate check
    if (pIdLower) {
      if (seenInFile.has(pIdLower)) {
        errors.push(`Duplicate Project ID in file: ${row.manual_project_id}`);
      } else {
        seenInFile.add(pIdLower);
      }
    }

    let status = "NEW"; // NEW, UPDATED, FAILED, SKIPPED
    if (errors.length > 0) {
      status = "FAILED";
      failedCount++;
    } else if (existingSet.has(pIdLower)) {
      status = "UPDATED";
      updatedCount++;
    } else {
      status = "NEW";
      newCount++;
    }

    validatedRows.push({
      rowIndex: rowNum,
      data: row,
      status,
      errors,
      isValid: errors.length === 0,
    });
  });

  return {
    totalRows: mappedRows.length,
    newCount,
    updatedCount,
    skippedCount,
    failedCount,
    validRows: validatedRows.filter((r) => r.isValid),
    erroredRows: validatedRows.filter((r) => !r.isValid),
    allRows: validatedRows,
  };
};

/**
  Download CSV Error Report
 */
export const downloadErrorReport = (erroredRows) => {
  if (!erroredRows || erroredRows.length === 0) return;

  let csvContent = "Row Number,Project ID,Account,Errors\n";
  erroredRows.forEach((r) => {
    const pId = `"${(r.data.manual_project_id || "").replace(/"/g, '""')}"`;
    const acc = `"${(r.data.account || "").replace(/"/g, '""')}"`;
    const errs = `"${r.errors.join("; ").replace(/"/g, '""')}"`;
    csvContent += `${r.rowIndex},${pId},${acc},${errs}\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Project_Import_Error_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
