import { Order, OrderStatus } from '@stamhoofd/structures';

import { Filter } from "./Filter";

export class StatusFilter implements Filter {
    status: OrderStatus;
    invert = false;

    constructor(status: OrderStatus, invert = false) {
        this.status = status
        this.invert = invert
    }

    getName(): string {
        switch (this.status) {
            case OrderStatus.Created: return this.invert ? "Niet nieuw" : "Nieuw";
            case OrderStatus.Prepared: return this.invert ? "Niet verwerkt" :"Verwerkt";
            case OrderStatus.Collect: return this.invert ? "Ligt niet klaar" :"Ligt klaar";
            case OrderStatus.Completed: return this.invert ? "Niet voltooid" :"Voltooid";
            case OrderStatus.Canceled: return this.invert ? "Niet geannuleerd" : "Geannuleerd";
        }
        throw new Error("Unknown status")
    }

    doesMatch(order: Order): boolean {
       return this.invert ? (order.status !== this.status) : (order.status === this.status)
    }

    static generateAll() {
        const base = Object.values(OrderStatus).map(status => new StatusFilter(status))

        base.push(new StatusFilter(OrderStatus.Created, true))
        base.push(new StatusFilter(OrderStatus.Prepared, true))
        base.push(new StatusFilter(OrderStatus.Collect, true))
        base.push(new StatusFilter(OrderStatus.Completed, true))
        base.push(new StatusFilter(OrderStatus.Canceled, true))

        return base
    }
}
