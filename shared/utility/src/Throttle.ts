/**
 * Named incorrectly, is in fact debounce
 */
export const throttle = <T extends any[]>(func: (...args: T) => unknown | Promise<unknown>, limit: number) => {
    let lastFunc: ReturnType<typeof setTimeout>;
    let lastRan: number;
    return function (this: any, ...args: T) {
        const context = this;
        if (lastRan) {
            clearTimeout(lastFunc);
        }
        lastRan = Date.now();

        lastFunc = setTimeout(function () {
            if (Date.now() - lastRan >= limit) {
                func.apply(context, args);
                lastRan = Date.now();
            }
        }, limit - (Date.now() - lastRan));
    };
};

/**
 * This is a real throttle. The throttle method in utility is a debounce.
 */
export function realThrottle(mainFunction: (...args: unknown[]) => unknown, delay: number) {
    let timerFlag: ReturnType<typeof setTimeout> | null = null; // Variable to keep track of the timer
    let runAtEnd = false;

    // Returning a throttled version
    return (...args: unknown[]) => {
        if (timerFlag === null) { // If there is no timer currently running
            requestAnimationFrame(() => {
                mainFunction(...args); // Execute the main function
            });
            runAtEnd = false;
            timerFlag = setTimeout(() => { // Set a timer to clear the timerFlag after the specified delay
                requestAnimationFrame(() => {
                    timerFlag = null; // Clear the timerFlag to allow the main function to be executed again
                    if (runAtEnd) {
                        mainFunction(...args);
                    }
                });
            }, delay);
        } else {
            // Make sure to run at the end of current period
            runAtEnd = true;
        }
    };
}
