import type { Request, RequestMiddleware } from '@node/endpoints';
import type { SimpleError } from '@common/errors';
import { isSimpleError, isSimpleErrors } from '@common/errors';

/**
 * Human messages for error codes thrown by packages that cannot use $t themselves (e.g. @stamhoofd/filters).
 */
const humanMessages = new Map<string, () => string>([
    ['unknown_filter', () => $t('%1IF')],
]);

/**
 * Adds a translated human message to errors that were thrown without one.
 *
 * Register this *before* ContextMiddleware: wrapRun wrappers are applied in registration order, so this
 * one runs inside the request context and $t uses the language of the request.
 */
export const HumanErrorMessageMiddleware: RequestMiddleware = {
    async wrapRun<T>(run: () => Promise<T>, _request: Request): Promise<T> {
        try {
            return await run();
        }
        catch (error) {
            if (isSimpleError(error)) {
                addHumanMessage(error);
            }
            else if (isSimpleErrors(error)) {
                error.errors.forEach(addHumanMessage);
            }
            throw error;
        }
    },

    handleRequest() {
        // Noop
    },
};

function addHumanMessage(error: SimpleError) {
    if (error.human) {
        return;
    }
    const human = humanMessages.get(error.code);
    if (human) {
        error.human = human();
    }
}
