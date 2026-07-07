import { NumberFilterFormat } from '#filters/NumberFilterFormat.ts';
import { DateFilterBuilder } from '../DateUIFilter';
import { getCustomerUIFilterBuilders } from '../filterBuilders';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { NumberFilterBuilder } from '../NumberUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilterBuilders } from '../UIFilter';

export function getInvoicesUIFilterBuilders() {
    const builders: UIFilterBuilders = [
        new StringFilterBuilder({
            name: $t(`Factuurnummer`),
            key: 'number',
        }),
        new DateFilterBuilder({
            name: $t(`Factuurdatum`),
            key: 'invoicedAt',
            nullable: true,
        }),
        new NumberFilterBuilder({
            name: $t(`Bedrag incl. BTW`),
            type: NumberFilterFormat.Currency,
            key: 'totalWithVAT',
        }),
        new NumberFilterBuilder({
            name: $t(`Bedrag excl. BTW`),
            type: NumberFilterFormat.Currency,
            key: 'totalWithoutVAT',
        }),
        new DateFilterBuilder({
            name: $t(`Aanmaakdatum`),
            key: 'createdAt',
        }),
        getCustomerUIFilterBuilders()[0],
    ];

    builders.unshift(
        new GroupUIFilterBuilder({
            builders,
        }),
    );

    return builders;
}
