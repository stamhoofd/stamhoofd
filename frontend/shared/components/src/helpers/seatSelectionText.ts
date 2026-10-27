import { Formatter } from '@stamhoofd/utility';

function formatSeats(amount: number) {
    return Formatter.pluralText(amount, $t('%12Y'), $t('%UL'));
}

/**
 * What is left to do while choosing seats, e.g. 'Kies nog 2 plaatsen'
 */
export function getSeatSelectionTitle(amount: number, selectedAmount: number): string {
    const remaining = amount - selectedAmount;
    if (remaining === 0) {
        return $t('%12X');
    }
    if (remaining === amount) {
        return $t('Kies {seats}', { seats: formatSeats(remaining) });
    }
    return $t('Kies nog {seats}', { seats: formatSeats(remaining) });
}

export function getSeatSelectionDescription(amount: number): string {
    return $t('%12Z') + ' ' + formatSeats(amount) + ' ' + $t('%12a');
}
