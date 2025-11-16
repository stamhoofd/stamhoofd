import { IntegerDecoder } from '@simonbackx/simple-encoding';

export const upgradePriceFrom2To4DecimalPlaces = {
    decoder: IntegerDecoder,
    upgrade: (oldValue: number | null) => {
        if (oldValue === null || oldValue === undefined) {
            return null;
        }
        if (typeof oldValue !== 'number') {
            console.warn('Unexpcted number when upgrading using upgradePrice migration. Got', oldValue);
            return oldValue;
        }
        return oldValue * 100;
    },
    downgrade: (newValue: number | null) => {
        if (newValue === null || newValue === undefined) {
            return null;
        }
        if (typeof newValue !== 'number') {
            console.warn('Unexpcted number when downgrading using upgradePrice migration. Got', newValue);
            return newValue;
        }
        return Math.round(newValue / 100);
    },
    version: 389,
};
