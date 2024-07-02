import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';

import { ViewportHelper } from '../ViewportHelper';
/***
 * Distributes errors to components that ask for it. The first that asks receives
 */
export class ErrorBox {
    /// Remaining errors to distribute
    errors: SimpleErrors
    scrollToElements: [any[], HTMLElement][] = []
    scrollTimer?: number

    constructor(errors: unknown) {
        if (isSimpleError(errors)) {
            this.errors = new SimpleErrors(errors)
        } else if (isSimpleErrors(errors)) {
            this.errors = errors
        } else {
            this.errors = new SimpleErrors(new SimpleError({
                code: "unknown_error",
                message: (errors as Error).message
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


    scrollIntoView(element: HTMLElement) {
        // default scrollIntoView is broken on Safari and sometimes causes the scrollview to scroll too far and get stuck
        const scrollElement = ViewportHelper.getScrollElement(element)
        const elRect = element.getBoundingClientRect()
        const scrollRect = scrollElement.getBoundingClientRect()

        let scrollPosition = elRect.bottom - scrollRect.top - scrollElement.clientHeight + scrollElement.scrollTop
        // TODO: add the bottom padding of scrollRect as an extra offset (e.g. for the keyboard of st-view)

        let bottomPadding = parseInt(window.getComputedStyle(scrollElement, null).getPropertyValue('padding-bottom'))
        if (isNaN(bottomPadding)) {
            bottomPadding = 25
        }
        let elBottomPadding = parseInt(window.getComputedStyle(element, null).getPropertyValue('padding-bottom'))
        if (isNaN(elBottomPadding)) {
            elBottomPadding = 0
        }
        scrollPosition += Math.max(0, bottomPadding - elBottomPadding)
        scrollPosition = Math.max(0, Math.min(scrollPosition, scrollElement.scrollHeight - scrollElement.clientHeight))

        const exponential = function(x: number): number {
            return x === 1 ? 1 : 1 - Math.pow(1.5, -20 * x);
        }

        ViewportHelper.scrollTo(scrollElement, scrollPosition, Math.min(600, Math.max(300, Math.abs(element.scrollTop - scrollPosition) / 2)), exponential)
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

        if (firstElement) {
            this.scrollIntoView(firstElement)
        }
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
