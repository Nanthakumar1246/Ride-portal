/**
 * Statuses that close out a log and therefore need evidence: the user must
 * supply remarks AND a supporting attachment before the change is accepted.
 */
const PROOF_REQUIRED_STATUSES = ["closed & acknowledged", "hold"];

export function statusRequiresProof(status) {
  return PROOF_REQUIRED_STATUSES.includes(String(status || "").trim().toLowerCase());
}

/**
 * Validates a status transition that requires proof.
 * Returns an error message when the change must be rejected, or null when it
 * is allowed. Only a *change into* one of the proof statuses is policed, so
 * editing other fields on an already-closed record is not blocked.
 */
export function validateStatusProof({ oldStatus, newStatus, remarks, hasAttachment }) {
  if (!newStatus) return null;
  if (String(oldStatus || "").trim() === String(newStatus).trim()) return null;
  if (!statusRequiresProof(newStatus)) return null;

  if (!String(remarks || "").trim()) {
    return `Remarks are required when setting status to "${newStatus}".`;
  }
  if (!hasAttachment) {
    return `An attachment is required when setting status to "${newStatus}".`;
  }
  return null;
}

/** Normalizes a multer file into the columns stored on the history row. */
export function attachmentFields(file) {
  if (!file) return { attachment_name: null, attachment_path: null };
  return {
    attachment_name: file.originalname,
    attachment_path: String(file.path).replace(/\\/g, "/").replace(/^.*?uploads\//i, "uploads/"),
  };
}
