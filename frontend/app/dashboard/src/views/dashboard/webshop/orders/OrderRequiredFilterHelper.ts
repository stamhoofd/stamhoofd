import { OrderStatus, StamhoofdFilter } from '@stamhoofd/structures';

export class OrderRequiredFilterHelper {
    static getDefault(): StamhoofdFilter {
        return {
            status: {
                $neq: OrderStatus.Deleted,
            },
        };
    }

    static isDefault(filter: StamhoofdFilter): boolean {
        const defaultFilter = OrderRequiredFilterHelper.getDefault();
        return JSON.stringify(defaultFilter) === JSON.stringify(filter);
    }
}
