export const REFERENCES_KEY = 'references' as const;

// format: {@alias.key.subkey} or {@key} or {name} for parameters
// where alias must be declared in [references] block, or key is local
// and whitespace between { and } is allowed
export const EMBEDDING_REGEX = /\{\s*@([a-zA-Z0-9._-]+)(?:\.[a-zA-Z0-9._-]+)*\s*\}/gs;
export const PARAMETER_REGEX = /\{([a-zA-Z0-9._-]+)\}/gs;
