/** Exact, allocation-free comparison for two already parsed PIN strings. */
export function pinsMatch(submitted: string, expected: string): boolean {
  if (submitted.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < submitted.length; index++) {
    difference |= submitted.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}
