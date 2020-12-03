import { Order, OrderStatus } from '@stamhoofd/structures';

import { Filter } from "./Filter";

export class StatusFilter implements Filter {
    status: OrderStatus;

    constructor(status: OrderStatus) {
        this.status = status
    }

    getName(): string {
        switch (this.status) {
            case OrderStatus.Created: return "Te verwerken";
            case OrderStatus.Prepared: return "Verwerkt";
            case OrderStatus.Completed: return "Voltooid";
            case OrderStatus.Canceled: return "Geannuleerd";
        }
        throw new Error("Unknown status")
    }

    doesMatch(order: Order): boolean {
       return order.status === this.status
    }

    static generateAll() {
        return Object.values(OrderStatus).map(status => new StatusFilter(status))
    }
}
