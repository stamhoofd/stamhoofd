import { STError, STErrors } from '@stamhoofd-common/errors';
/***
 * Distributes errors to components that ask for it. The first that asks receives
 */
export class ErrorBox {
    /// Remaining errors to distribute
    errors: STErrors

    constructor(errors: STErrors) {
        this.errors = errors
    }

    /// Register a handler for field.
    /// Returns a reference to STErrors that will get adjusted when arrays are distrubuted
    forFields(fields: string[]): STErrors {
        const errors = new STErrors()

        for (let index = this.errors.errors.length - 1; index >= 0; index--) {
            const error = this.errors.errors[index];
            if (error.doesMatchFields(fields)) {
                errors.addError(error)
                this.errors.removeErrorAt(index)
            }
        }

        return errors
    }

    get remaining(): STErrors {
        // note that this is a reference! So the errors can still change
        return this.errors
    }
}