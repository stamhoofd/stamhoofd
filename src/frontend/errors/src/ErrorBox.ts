import { ClientErrors } from '@stamhoofd-backend/routing/src/ClientErrors';

/***
 * Distributes errors to components that ask for it. The first that asks receives
 */
export class ErrorBox {
    /// Remaining errors to distribute
    errors: ClientErrors

    constructor(errors: ClientErrors) {
        this.errors = errors
    }

    /// Register a handler for field.
    /// Returns a reference to ClientErrors that will get adjusted when arrays are distrubuted
    forFields(fields: string[]): ClientErrors {
        const errors = new ClientErrors()

        for (let index = this.errors.errors.length - 1; index >= 0; index--) {
            const error = this.errors.errors[index];
            if (error.doesMatchFields(fields)) {
                errors.addError(error)
                this.errors.removeErrorAt(index)
            }
        }

        return errors
    }

    get remaining(): ClientErrors {
        // note that this is a reference! So the errors can still change
        return this.errors
    }
}