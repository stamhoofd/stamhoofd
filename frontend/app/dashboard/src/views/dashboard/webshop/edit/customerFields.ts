import type { CustomerFieldKey } from '@stamhoofd/structures/webshops/CustomerSettings.js';

/**
 * The built-in customer fields, in the order they are shown and asked
 */
export function getCustomerFields(): { key: CustomerFieldKey; name: string; icon: string }[] {
    return [
        { key: 'name', name: $t('%1Os'), icon: 'user' },
        { key: 'email', name: $t('%1FK'), icon: 'email' },
        { key: 'phone', name: $t('%2k'), icon: 'smartphone' },
        { key: 'birthDay', name: $t('%17w'), icon: 'gift' },
        { key: 'gender', name: $t('%Zd4'), icon: 'team' },
        { key: 'address', name: $t('%Cn'), icon: 'location' },
    ];
}
