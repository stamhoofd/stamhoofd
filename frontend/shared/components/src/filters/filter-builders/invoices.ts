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
            name: $t(`%1YZ`),
            key: 'number',
        }),
        new DateFilterBuilder({
            name: $t(`%1J6`),
            key: 'invoicedAt',
            nullable: true,
        }),
        new NumberFilterBuilder({
            name: $t(`%1JC`),
            type: NumberFilterFormat.Currency,
            key: 'totalWithVAT',
        }),
        new NumberFilterBuilder({
            name: $t(`%1JD`),
            type: NumberFilterFormat.Currency,
            key: 'totalWithoutVAT',
        }),
        new DateFilterBuilder({
            name: $t(`%1Jc`),
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
