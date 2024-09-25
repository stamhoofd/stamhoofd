// Vue compability
type TranslateResult = string;

/**
 * Shared structure between frontend and backend
 */
export interface I18n {
    t(key: string): TranslateResult
}
