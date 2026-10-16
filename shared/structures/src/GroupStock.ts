import type { StockReservation } from './StockReservation.js';

export interface GroupStock {
    id: string;
    stockReservations: StockReservation[];
}

export interface RegistrationStock {
    group: GroupStock;
    getCartPendingStockReservations(): StockReservation[];
}
