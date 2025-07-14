import { OrderStatus, StamhoofdFilter } from '@stamhoofd/structures';

export class OrderRequiredFilterHelper {
    static getDefault(webshopId: string): StamhoofdFilter {
        return {
            webshopId,
            status: {
                $neq: OrderStatus.Deleted,
            },
        };
    }

    static isDefault(webshopId: string, filter: StamhoofdFilter): boolean {
        const defaultFilter = OrderRequiredFilterHelper.getDefault(webshopId);
        return JSON.stringify(defaultFilter) === JSON.stringify(filter);
    }
}
