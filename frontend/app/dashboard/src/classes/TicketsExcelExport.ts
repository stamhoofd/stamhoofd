import type { XlsxTransformerColumn, XlsxTransformerSheet, XlsxWorkbookFilter } from '@stamhoofd/excel-writer';
import { exportToExcel, XlsxWriter } from '@stamhoofd/excel-writer';
import type { PrivateOrderWithTickets } from '@stamhoofd/structures';

class TicketsExcelExport {
    static export(webshop: Webshop, orders: PrivateOrderWithTickets[]) {

    }
}

// const baseOrderColumns

const baseOrderColumns: XlsxTransformerColumn<PrivateOrderWithTickets>[] = [

];

function exportTest<T>(filter: XlsxWorkbookFilter, definitions: XlsxTransformerSheet<T, unknown>[]) {
    exportToExcel({
        definitions,
        writer: new XlsxWriter(),
    });
}
