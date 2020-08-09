import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors'
import * as Sentry from '@sentry/browser';

export const Logger = {
    error(error: Error) {
        console.error(error)
        if (!isSimpleError(error) && !isSimpleErrors(error)) {
            Sentry.captureException(error);
        }
    }
}