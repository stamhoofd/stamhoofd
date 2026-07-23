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
