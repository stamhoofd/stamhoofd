import { FilterWrapperMarker, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, PaymentType, PaymentTypeHelper } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { DateFilterBuilder } from '../DateUIFilter';
import { getCustomerUIFilterBuilders } from '../filterBuilders';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder } from '../NumberUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilterBuilders } from '../UIFilter';
import { useOrganization } from '#hooks/useOrganization.ts';
import { NumberFilterFormat } from '#filters/NumberFilterFormat.ts';

export class PaymentFilterBuilders {
    static get method() {
        return new MultipleChoiceFilterBuilder({
            name: $t(`%M7`),
            options: Object.values(PaymentMethod).map((method) => {
                return new MultipleChoiceUIFilterOption(PaymentMethodHelper.getNameCapitalized(method), method);
            }),
            wrapper: {
                method: {
                    $in: FilterWrapperMarker,
                },
            },
        });
    }

    static get status() {
        return new MultipleChoiceFilterBuilder({
            name: $t(`%1A`),
            options: Object.values(PaymentStatus).map((method) => {
                return new MultipleChoiceUIFilterOption(PaymentStatusHelper.getNameCapitalized(method), method);
            }),
            wrapper: {
                status: {
                    $in: FilterWrapperMarker,
                },
            },
        })
    }

    static get invoiced() {
        return new MultipleChoiceFilterBuilder({
            name: $t(`%1JO`),
            options: [
                new MultipleChoiceUIFilterOption($t('%1JB'), null),
            ],
            wrapper: {
                invoiceId: FilterWrapperMarker
            },
        })
    }

    static get type() {
        return new MultipleChoiceFilterBuilder({
            name: $t(`%1LP`),
            options: Object.values(PaymentType).map((method) => {
                return new MultipleChoiceUIFilterOption(Formatter.capitalizeFirstLetter(PaymentTypeHelper.getName(method)), method);
            }),
            wrapper: {
                type: {
                    $in: FilterWrapperMarker,
                },
            },
        })
    }

    static get price() {
        return new NumberFilterBuilder({
            name: $t(`%1IP`),
            type: NumberFilterFormat.Currency,
            key: 'price',
        })
    }

    static get paidAt() {
        return new DateFilterBuilder({
            name: $t(`%1Jb`),
            key: 'paidAt',
        });
    }

    static get createdAt() {
        return new DateFilterBuilder({
            name: $t(`%1Jc`),
            key: 'createdAt',
        });
    }

    static get transferDescription() {
        return new StringFilterBuilder({
            name: $t('%ox'),
            key: 'transferDescription',
        })
    }
}

export function usePaymentsUIFilterBuilders() {
    const organization = useOrganization()
    
    const builders: UIFilterBuilders = [
        PaymentFilterBuilders.method,
        PaymentFilterBuilders.status,
        PaymentFilterBuilders.type,
        PaymentFilterBuilders.price,
        PaymentFilterBuilders.paidAt,
        PaymentFilterBuilders.createdAt,
        PaymentFilterBuilders.transferDescription,
        getCustomerUIFilterBuilders()[0],
    ];

    if (organization.value && organization.value.meta.invoicesEnabled) {
        builders.push(PaymentFilterBuilders.invoiced)
    }

    builders.unshift(
        new GroupUIFilterBuilder({
            builders,
        }),
    );

    return builders;
};
