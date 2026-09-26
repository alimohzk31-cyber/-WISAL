const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

function normalizeInput(value?: string | null): string | undefined {
  const input = value?.trim();
  if (!input || input.startsWith('//')) return undefined;
  return input;
}

/** Returns a safe external HTTP(S) URL, or undefined for unsupported input. */
export function sanitizeExternalUrl(value?: string | null): string | undefined {
  const input = normalizeInput(value);
  if (!input) return undefined;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`;
  try {
    const url = new URL(candidate);
    if (!HTTP_PROTOCOLS.has(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** Returns a safe telephone URL while preserving the displayed phone value. */
export function sanitizeTelUrl(value?: string | null): string | undefined {
  const input = normalizeInput(value);
  if (!input || !/^[+\d][\d ()-]{6,29}$/.test(input)) return undefined;
  const compact = input.replace(/[ ()-]/g, '');
  if ((compact.match(/\+/g) ?? []).length > 1 || (compact.includes('+') && !compact.startsWith('+'))) return undefined;
  return `tel:${compact}`;
}
