/**
 * Builds the body for a status update.
 *
 * With no file the plain object is returned and the request stays JSON, so
 * every existing update path is untouched. With a file the fields are moved
 * into a FormData so the file rides along as "attachment"; the module API
 * helpers detect FormData and drop the JSON Content-Type accordingly.
 */
export function withAttachment(fields, file) {
  if (!file) return fields;

  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    form.append(key, value === null || value === undefined ? "" : value);
  });
  form.append("attachment", file);
  return form;
}

export default withAttachment;
