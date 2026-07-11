import type { XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import type { LimitedFilteredRequest, PrivateOrder } from '@stamhoofd/structures';
import { ExcelExportType } from '@stamhoofd/structures';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { GetWebshopOrdersEndpoint } from '../endpoints/organization/dashboard/webshops/GetWebshopOrdersEndpoint.js';

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<PrivateOrder, PrivateOrder> = {
    id: 'orders',
    name: $t(`Bestelling per lijn`),
    columns: [
        {
            id: 'id',
            name: $t(`%d`),
            width: 40,
            getValue: (order: PrivateOrder) => ({
                value: order.id,
            }),
        },

    ],
};

// type OrderWithtTickets = {
//     receivableBalance: DetailedReceivableBalance;
//     balanceItem: BalanceItemWithPayments;
// };

/**
 * Prevent repeating work
 */
class OrderColumnData {
    constructor(readonly order: PrivateOrder) {

    }
}

ExportToExcelEndpoint.loaders.set(ExcelExportType.Orders, {
    fetch: async (query: LimitedFilteredRequest) => {
        const ordersResponse = await GetWebshopOrdersEndpoint.buildData(query);
        // const orderIds = ordersResponse.results.map(order => order.id);

        // if (ordersResponse.results.length === 0) {
        //     return ordersResponse;
        // }

        // // check if all orders are from the same webshop
        // const webshopId = ordersResponse.results[0].webshopId;

        // if (ordersResponse.results.some(o => o.webshopId !== webshopId)) {
        //     throw new Error('All orders must be from the same webshop');
        // }

        // // get tickets
        // const tickets = await Ticket.select()
        //     // narrow down to webshop
        //     .where('webshopId', webshopId)
        //     .where('orderId', orderIds)
        //     .andWhere('deletedAt', null)
        //     .fetch();

        // const orderTicketsMap = new Map<string, Ticket[]>();
        // for (const ticket of tickets) {
        //     let array = orderTicketsMap.get(ticket.orderId);
        //     if (!array) {
        //         array = [];
        //         orderTicketsMap.set(ticket.orderId, array);
        //     }
        //     array.push(ticket);
        // }
        return ordersResponse;
    },
    sheets: [
        sheet,
    ],
});
