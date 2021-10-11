import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
/***
 * Distributes errors to components that ask for it. The first that asks receives
 */
export class ErrorBox {
    /// Remaining errors to distribute
    errors: SimpleErrors
    scrollToElements: [any[], HTMLElement][] = []
    scrollTimer?: number

    constructor(errors: Error) {
        if (isSimpleError(errors)) {
            this.errors = new SimpleErrors(errors)
        } else if (isSimpleErrors(errors)) {
            this.errors = errors
        } else {
            this.errors = new SimpleErrors(new SimpleError({
                code: "unknown_error",
                message: errors.message
            }))
        }
    }

    /// Register a handler for field.
    /// Returns a reference to SimpleErrors that will get adjusted when arrays are distrubuted (this is not yet implemented)
    forFields(fields: string[]): SimpleErrors {
        const errors = new SimpleErrors()

        for (let index = this.errors.errors.length - 1; index >= 0; index--) {
            const error = this.errors.errors[index];
            if (error.doesMatchFields(fields)) {
                errors.unshiftError(error)
                this.errors.removeErrorAt(index)
            }
        }

        return errors
    }

    get remaining(): SimpleErrors {
        // note that this is a reference! So the errors can still change
        return this.errors
    }

    private fireScroll() {
        // Take the highest element
        let minimum: number | undefined
        let firstElement: HTMLElement | undefined

        for (const [arr, element] of this.scrollToElements) {
            if (arr.length == 0) {
                continue;
            }
            const pos = element.getBoundingClientRect().top
            if (minimum === undefined || pos < minimum) {
                minimum = pos
                firstElement = element
            }
        }

        firstElement?.scrollIntoView({
            block: "center",
            behavior: "smooth"
        });
        this.scrollToElements = []
        this.scrollTimer = undefined
    }

    /// Scroll to an element, errorBox will decide which one if it is called multiple times
    // You need to provide the array of errors because it is possible to change the errors after this call
    // So we need to detect if the errors are empty or not
    scrollTo(errors: any[], el: HTMLElement) {
        this.scrollToElements.push([errors, el])

        if (!this.scrollTimer) {
            this.scrollTimer = window.setTimeout(this.fireScroll.bind(this), 250);
        }
    }
}