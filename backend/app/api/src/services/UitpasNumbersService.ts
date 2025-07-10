import { Model } from '@simonbackx/simple-database';
import { Order, WebshopUitpasNumber } from '@stamhoofd/models';
import { OrderStatus } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

function shouldReserveUitpasNumbers(status: OrderStatus): boolean {
    return status !== OrderStatus.Canceled && status !== OrderStatus.Deleted;
}

function mapUitpasNumbersToProducts(order: Order): Map<string, string[]> {
    const items = order.data.cart.items;
    const productIdToUitpasNumbers: Map<string, string[]> = new Map();
    for (const item of items) {
        const a = productIdToUitpasNumbers.get(item.product.id);
        if (a) {
            a.push(...item.uitpasNumbers);
        }
        else {
            productIdToUitpasNumbers.set(item.product.id, [...item.uitpasNumbers]); // make a copy
        }
    }
    return productIdToUitpasNumbers;
}

function areUitpasNumbersChanged(oldOrder: Order, newOrder: Order): boolean {
    const oldMap = mapUitpasNumbersToProducts(oldOrder);
    const newMap = mapUitpasNumbersToProducts(newOrder);
    if (oldMap.size !== newMap.size) {
        return true;
    }
    for (const [productId, uitpasNumbers] of oldMap.entries()) {
        const newUitpasNumbers = newMap.get(productId);
        if (!newUitpasNumbers) {
            return true;
        }
        if (newUitpasNumbers.length !== uitpasNumbers.length) {
            return true;
        }
        for (const uitpasNumber of uitpasNumbers) {
            if (!newUitpasNumbers.includes(uitpasNumber)) {
                return true;
            }
        }
    }
    return false;
}

export class UitpasNumberService {
    static listening = false;

    static async updateUitpasNumbers(order: Order) {
        await this.deleteUitpasNumbers(order);
        await this.createUitpasNumbers(order);
    }

    static async createUitpasNumbers(order: Order) {
        const mappedUitpasNumbers = mapUitpasNumbersToProducts(order); // productId -> Set of uitpas numbers
        console.log('Creating uitpas numbers for order', order.id, 'with uitpas numbers', mappedUitpasNumbers);
        // add to DB
        const insert = WebshopUitpasNumber.insert();
        insert.columns(
            'id',
            'webshopId',
            'orderId',
            'productId',
            'uitpasNumber',
        );
        const rows = [...mappedUitpasNumbers].flatMap(([productId, uitpasNumbers]) => {
            console.log(`Creating uitpas numbers for product ${productId} with uitpas numbers`, uitpasNumbers);
            return uitpasNumbers.map(uitpasNumber => [
                uuidv4(),
                order.webshopId,
                order.id,
                productId,
                uitpasNumber,
            ]);
        });
        console.log(`Inserting ${rows.length} uitpas numbers for order ${order.id}`);
        console.log(rows);
        insert.values(...rows);
        await insert.insert();
    }

    static async deleteUitpasNumbers(order: Order) {
        await WebshopUitpasNumber.delete().where('webshopId', order.webshopId)
            .andWhere('orderId', order.id);
    }

    static listen() {
        if (this.listening) {
            return;
        }
        this.listening = true;
        Model.modelEventBus.addListener(this, async (event) => {
            try {
                if (event.model instanceof Order) {
                    // event.type ==='deteled' -> not needed as foreign key will delete the order
                    if (event.type === 'created' && shouldReserveUitpasNumbers(event.model.status)) {
                        await this.createUitpasNumbers(event.model);
                        return;
                    }
                    if (event.type === 'updated') {
                        if (event.changedFields.status) {
                            const statusBefore = event.originalFields.status as OrderStatus;
                            const statusAfter = event.changedFields.status as OrderStatus;
                            const shouldReserveAfter = shouldReserveUitpasNumbers(statusAfter);
                            if (shouldReserveUitpasNumbers(statusBefore) !== shouldReserveAfter) {
                                if (shouldReserveAfter) {
                                    await this.createUitpasNumbers(event.model);
                                    return;
                                }
                                await this.deleteUitpasNumbers(event.model);
                                return;
                            }
                        }
                        if (event.changedFields.data) {
                            const oldOrder = event.getOldModel() as Order;
                            if (areUitpasNumbersChanged(oldOrder, event.model)) {
                                await this.updateUitpasNumbers(event.model);
                            }
                        }
                    }
                }
            }
            catch (e) {
                console.error('Failed to update UiTPAS-numbers after order update', e);
            }
        });
    }
};
