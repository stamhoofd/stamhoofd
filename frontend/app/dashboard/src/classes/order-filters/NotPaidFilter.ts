import { Order, OrderStatus, PaymentStatus } from '@stamhoofd/structures';

import { Filter } from "./Filter";

export class NotPaidFilter implements Filter {
    getName(): string {
        return "Nog niet betaald"
    }

    doesMatch(order: Order): boolean {
       return order.payment !== null && order.payment.status !== PaymentStatus.Succeeded
    }
}
