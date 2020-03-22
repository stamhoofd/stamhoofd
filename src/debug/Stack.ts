import path from "path"
const appDir = path.join(__dirname, '../../')
console.log('appdir', appDir)

export default {
    get stack() {
        // Save original Error.prepareStackTrace
        const origPrepareStackTrace = Error.prepareStackTrace

        // Override with function that just returns `stack`
        Error.prepareStackTrace = function (_, stack) {
            return stack
        }

        // Create a new `Error`, which automatically gets `stack`
        const err = new Error()

        // Evaluate `err.stack`, which calls our new `Error.prepareStackTrace`
        const stack = err.stack

        // Restore original `Error.prepareStackTrace`
        Error.prepareStackTrace = origPrepareStackTrace
        return stack;
    },

    get parentLine(): number {
        return this.stack[4].getLineNumber();
    },

    get parentFunction(): string {
        return this.stack[4].getFunctionName();
    },

    get parentFile(): string {
        return path.relative(appDir, this.stack[4].getFileName());
    }
}