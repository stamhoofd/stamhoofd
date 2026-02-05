/**
 * Named incorrectly, is in fact debounce
 */
export const throttle = (func: any, limit: any) => {
    let lastFunc: NodeJS.Timeout;
    let lastRan: any;
    return function (this: any) {
        const context = this;
        // eslint-disable-next-line prefer-rest-params
        const args = arguments;
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
