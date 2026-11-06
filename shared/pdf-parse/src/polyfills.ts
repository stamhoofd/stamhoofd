/**
 * What pdf.js 6 expects of an engine but does not bring itself. Imported before pdf.js, because a
 * polyfill that arrives after the code that needs it is not one.
 *
 * `Promise.withResolvers` is the one this package has to supply. pdf.js uses it throughout - the
 * loading task, the worker transport and the message handler all build their capabilities with it -
 * and it arrived only in Safari 17.4, while `IPHONEOS_DEPLOYMENT_TARGET` is 15.0, so the app runs
 * on WebViews without it. The legacy build carries core-js polyfills for a long list of other
 * things (the `Set` methods, `Promise.try`, `URL.parse`, the iterator helpers) but not for this
 * one, because pdf.js's own browser baseline is above it.
 *
 * The rest of what an audit of the legacy build turns up needs nothing here:
 *
 * - `Object.hasOwn`, `Array.prototype.at` and `structuredClone` are Safari 15.4, and this
 *   repository's own frontend already uses all three, so they are not a floor pdf.js introduces.
 *   The parse path does not reach `structuredClone` at all any more: it was `LoopbackPort`, which a
 *   real `MessageChannel` replaces.
 * - `AbortSignal.any` is Safari 17.4 and genuinely missing, but every call site is in the
 *   annotation editor and the touch manager. Reading text reaches none of them, and polyfilling for
 *   code this package never calls would only hide the gap from whoever does call it. A consumer
 *   that mounts pdf.js's editor layers on an older WebView needs its own.
 * - `CompressionStream` is Safari 16.4 and only used when writing a pdf back out.
 */

interface PromiseResolvers<T> {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
}

// `lib` here is es2023, which predates the method, so it is declared rather than assumed. If a
// later `lib` brings its own declaration the two merge as overloads of the same shape.
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

        // `this` rather than `Promise`, since the spec builds the capability on the subclass it is
        // called on and pdf.js is free to call it on one
        const promise = new this<T>((promiseResolve, promiseReject) => {
            resolve = promiseResolve;
            reject = promiseReject;
        });

        return { promise, resolve, reject };
    };
}
