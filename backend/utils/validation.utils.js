const ARCHE_EMAIL_REGEX = /^[^\s@]+@arche\.global$/i;

export function isValidBehalfOf(value) {
  if (value === undefined || value === null || String(value).trim() === "") return true;
  return ARCHE_EMAIL_REGEX.test(String(value).trim());
}
