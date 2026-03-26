import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilterBuilders } from '../UIFilter';

export function useGetWebshopUIFilterBuilders() {
    const getWebshopUIFilterBuilders = (): UIFilterBuilders => {
        return [
            new StringFilterBuilder({
                name: $t('Naam'),
                key: 'name',
            }),
        ];
    };

    return { getWebshopUIFilterBuilders };
}
