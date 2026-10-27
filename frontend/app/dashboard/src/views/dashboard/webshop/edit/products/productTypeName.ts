import { ProductType } from '@stamhoofd/structures';

export function getProductTypeName(type: ProductType): string {
    switch (type) {
        case ProductType.Product:
        case ProductType.Person:
            return $t('%Sc');
        case ProductType.Ticket: return $t('%2K');
        case ProductType.Voucher: return $t('%g');
        default: return '?';
    }
}
