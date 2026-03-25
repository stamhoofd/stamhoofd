import type { ImportError } from './ImportError';
import type { ImportMemberBaseResult } from './ImportMemberBaseResult';
import type { ImportMemberResult } from './ImportMemberResult';

export class ImportMembersBaseResultWithErrors {
    errors: ImportError[] = [];
    data: ImportMemberBaseResult[] = [];
}

export class ImportMembersResultWithErrors {
    errors: ImportError[] = [];
    data: ImportMemberResult[] = [];
}
