import { STError, STErrors } from '@stamhoofd-common/errors';
/***
 * Distributes errors to components that ask for it. The first that asks receives
 */
export class ErrorBox {
    /// Remaining errors to distribute
    errors: STErrors
    scrollToElements: [any[], HTMLElement][] = []
    scrollTimer?: number

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

        console.log("scroll to ", firstElement)

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