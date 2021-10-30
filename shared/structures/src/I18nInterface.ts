// Vue compability
interface LocaleMessages { [key: string]: any; }
type TranslateResult = string | LocaleMessages;

/**
 * Shared structure between frontend and backend
 */
export interface I18n {
    t(key: string): TranslateResult
}