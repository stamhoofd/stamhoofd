import { ImportError } from './ImportError';

export class ImportResult<T> {
    errors: ImportError[] = [];
    data: T[] = [];
}
