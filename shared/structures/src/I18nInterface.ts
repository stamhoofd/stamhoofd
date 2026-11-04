// Vue compability
type TranslateResult = string;

/**
 * Object literals are the translation-call boundary, not internal dictionary state.
 * Implementations normalize their own replacement entries to Maps before traversal;
 * callers can keep passing replacement objects without converting every template.
 */
export type TranslateMethod = (key: string, replace?: Record<string, string>) => TranslateResult;

/**
 * Shared structure between frontend and backend
 */
export interface I18n {
    /** Uses the literal-argument boundary documented by TranslateMethod. */
    t(key: string, replace?: Record<string, string>): TranslateResult;
}
