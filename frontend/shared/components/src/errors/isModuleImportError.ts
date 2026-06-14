/**
 * Detect errors that are thrown when a dynamically imported module fails to load.
 * The message differs per browser, so we match on all known variants:
 * - Chrome / Edge: "Failed to fetch dynamically imported module"
 * - Firefox: "error loading dynamically imported module"
 * - Safari: "Importing a module script failed"
 */
export function isModuleImportError(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return message.includes('dynamically imported module')
        || message.includes('importing a module script failed');
}
