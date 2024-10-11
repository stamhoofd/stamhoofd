// Vue compability
type TranslateResult = string;

export type TranslateMethod = (key: string, replace?: Record<string, string>) => TranslateResult;

/**
 * Shared structure between frontend and backend
 */
export interface I18n {
    t(key: string, replace?: Record<string, string>): TranslateResult;
}
