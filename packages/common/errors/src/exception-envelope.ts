import { isSimpleError } from './SimpleError.js';
import { isSimpleErrors, SimpleErrors } from './SimpleErrors.js';

const boundaries = [
    'backend.request',
    'backend.rejection',
    'backend.startup',
    'browser.vue',
    'browser.global',
    'capacitor.webview.vue',
] as const;
export type ExceptionBoundary = (typeof boundaries)[number];
export type ExceptionReport = { boundary: ExceptionBoundary; type: string };
// The delivery adapter receives the original exception for stack parsing only.
type Sink = (report: ExceptionReport, error: Error) => void | Promise<void>;
let sink: Sink | undefined;

/** Process/page-owned opt-in. An unset sink does no work; no SDK or network transport is installed. */
export function setExceptionEnvelopeSink(destination: Sink | undefined) {
    sink = destination;
}

/** Report unexpected exceptions only at registered application boundaries. */
export function captureExceptionEnvelope(boundary: ExceptionBoundary, error: unknown) {
    if (!sink) return;
    try {
        if (
            !boundaries.includes(boundary) ||
            !(error instanceof Error) ||
            error instanceof SimpleErrors ||
            isSimpleError(error) ||
            isSimpleErrors(error)
        )
            return;
        const type =
            error instanceof TypeError
                ? 'TypeError'
                : error instanceof RangeError
                  ? 'RangeError'
                  : error instanceof ReferenceError
                    ? 'ReferenceError'
                    : error instanceof SyntaxError
                      ? 'SyntaxError'
                      : 'Error';
        return Promise.resolve(sink({ boundary, type }, error)).catch(() => {});
    } catch {
        // A malformed exception or failed transport must not replace the application error.
    }
}
