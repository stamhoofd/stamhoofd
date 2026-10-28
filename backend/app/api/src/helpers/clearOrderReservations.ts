import type { OrderData } from '@stamhoofd/structures';

/**
 * The reserved fields of an order keep track of the stock, seats and time slot capacity that the order already holds.
 * They are only set by Order.updateStock, so they must be cleared for new orders coming from a client:
 * otherwise a client can skip stock and capacity checks by claiming it already holds those reservations.
 */
export function clearOrderReservations(data: OrderData) {
    for (const item of data.cart.items) {
        item.reservedAmount = 0;
        item.reservedPrices = new Map();
        item.reservedOptions = new Map();
        item.reservedSeats = [];
    }
    data.reservedOrder = false;
    data.reservedPersons = 0;
}
