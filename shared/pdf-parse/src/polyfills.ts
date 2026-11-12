/**
 * pdf.js 6 builds all of its capabilities with `Promise.withResolvers`, which arrived in Safari 17.4
 * while `IPHONEOS_DEPLOYMENT_TARGET` is 15.0, and the legacy build's core-js polyfills do not cover
 * it. An audit of the rest of that build found only `AbortSignal.any` also missing, and it is
 * reached solely from the annotation editor and the touch manager: polyfilling it here would hide
 * the gap from the consumer who does mount those.
 *
 * Must be imported before pdf.js.
 */

interface PromiseResolvers<T> {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
}

// `lib` is es2023, which predates the method. A later `lib` bringing its own declaration merges as
// an overload of the same shape.
declare global {
    interface PromiseConstructor {
        withResolvers<T>(): PromiseResolvers<T>;
    }
}

/** Writable, since the declaration above says the method is always there and here it may not be. */
type MaybePolyfilled = Omit<PromiseConstructor, 'withResolvers'> & {
    withResolvers?<T>(this: PromiseConstructor): PromiseResolvers<T>;
};

const promiseConstructor = Promise as MaybePolyfilled;

if (typeof promiseConstructor.withResolvers !== 'function') {
    promiseConstructor.withResolvers = function withResolvers<T>(this: PromiseConstructor): PromiseResolvers<T> {
        let resolve!: (value: T | PromiseLike<T>) => void;
        let reject!: (reason?: unknown) => void;

        // `this` rather than `Promise`: the spec builds the capability on the subclass it is called
        // on, and pdf.js is free to call it on one
        const promise = new this<T>((promiseResolve, promiseReject) => {
            resolve = promiseResolve;
            reject = promiseReject;
        });

        return { promise, resolve, reject };
    };
}
