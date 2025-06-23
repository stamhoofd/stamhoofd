import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { ImportError } from './ImportError';

export class ImportResult<T extends AutoEncoder> {
    errors: ImportError[] = [];
    data: PartialWithoutMethods<AutoEncoderPatchType<T>>[] = [];
}
