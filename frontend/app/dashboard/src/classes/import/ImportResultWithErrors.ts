import { ImportError } from './ImportError';
import { ImportMemberBaseResult } from './ImportMemberBaseResult';
import { ImportMemberResult } from './ImportMemberResult';

export class ImportMembersBaseResultWithErrors {
    errors: ImportError[] = [];
    data: ImportMemberBaseResult[] = [];
}

export class ImportMembersResultWithErrors {
    errors: ImportError[] = [];
    data: ImportMemberResult[] = [];
}
