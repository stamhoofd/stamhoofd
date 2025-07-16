import { ImportMemberResult } from '../../../../../classes/import/ImportMemberResult';

export class MemberImportReport {
    private _errorMessage: string | null = null;

    get errorMessage() {
        return this._errorMessage;
    }

    get hasError() {
        return this._errorMessage !== null;
    }

    get row() {
        return this.importResult.row;
    }

    get name() {
        const name = this.importResult.patchedDetails.name;
        if (name) {
            return name;
        }

        return $t('619645fe-f8a1-41aa-afcd-08612362ed36', { row: this.row });
    }

    constructor(readonly importResult: ImportMemberResult) {
    }

    setErrorMessage(message: string) {
        this._errorMessage = message;
    }
}
