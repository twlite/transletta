export const REFERENCES_KEY = 'references' as const;

// format: {@key.subkey.subsubkey}
// where subkeys may be optional
// and whitespace between { and } is allowed
export const DYNAMIC_CONTENT_REGEX = /\{(?:@|@?[a-zA-Z0-9._-]+)(?:\.[a-zA-Z0-9._-]+)*\}/gs;
