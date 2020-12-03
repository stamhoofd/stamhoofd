import {  Order } from '@stamhoofd/structures';

import { Filter } from "./Filter";

export class NoFilter implements Filter {
    getName(): string {
        return "Alle bestellingen";
    }

    doesMatch(_order: Order): boolean {
        return true;
    }
}
