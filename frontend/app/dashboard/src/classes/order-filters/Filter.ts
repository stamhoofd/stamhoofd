import { Order } from '@stamhoofd/structures';

export interface Filter {
    getName(): string;
    doesMatch(order: Order): boolean;
}