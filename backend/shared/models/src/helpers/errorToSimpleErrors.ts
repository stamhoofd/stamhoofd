import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';

export function errorToSimpleErrors(e: unknown) {
    if (isSimpleErrors(e)) {
        return e;
    } else if (isSimpleError(e)) {
        return new SimpleErrors(e);
    } else {
        return new SimpleErrors(
            new SimpleError({
                code: 'unknown_error',
                message: ((typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string') ? e.message : 'Unknown error'),
                human: $t(`%1ED`),
            }),
        );
    }
}
