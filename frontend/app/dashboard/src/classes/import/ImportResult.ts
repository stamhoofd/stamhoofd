import { ImportMemberResult } from './ExistingMemberResult';
import { ImportError } from './ImportError';
import { ImportMemberBase } from './ImportMemberBase';

export class ImportMembersBaseResult {
    errors: ImportError[] = [];
    data: ImportMemberBase[] = [];
}

export class ImportMembersResult {
    errors: ImportError[] = [];
    data: ImportMemberResult[] = [];
}
