import XLSX from 'xlsx';

export class ImportError {
    column: number;
    row: number;
    message: string;

    constructor(row: number, column: number, message: string) {
        this.row = row;
        this.column = column;
        this.message = message;
    }

    get cellPath(): string {
        return XLSX.utils.encode_cell({ r: this.row, c: this.column });
    }
}
