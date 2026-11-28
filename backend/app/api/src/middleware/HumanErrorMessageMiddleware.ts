import type { Request, RequestMiddleware } from '@stamhoofd/node-endpoints';
import type { SimpleError } from '@stamhoofd/common-errors';
import { isSimpleError, isSimpleErrors } from '@stamhoofd/common-errors';

/**
 * Human messages for error codes thrown by packages that cannot use $t themselves (the standalone libraries in /packages).
 */
const humanMessages = new Map<string, () => string>([
    ['unknown_filter', () => $t('%1IF')],
    ['invalid_sort', () => $t('%ZvO')],
    ['sorter_join_overlap', () => $t('%GU')],
    ['too_many_filter_values', () => $t('%1HH')],
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
        } catch (error) {
            if (isSimpleError(error)) {
                addHumanMessage(error);
            } else if (isSimpleErrors(error)) {
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
