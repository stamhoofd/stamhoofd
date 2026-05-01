import type { PrivateWebshop, WebshopPreview } from '@stamhoofd/structures';
import { CheckoutMethodType, CheckoutMethodTypeHelper, FilterWrapperMarker, OrderStatus, OrderStatusHelper, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { DateFilterBuilder } from '../DateUIFilter';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder, NumberFilterFormat } from '../NumberUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilterBuilders } from '../UIFilter';
import { getCartFilterBuilder } from './checkout';
import { simpleBooleanFilterFactory } from './helpers';
import { PaymentFilterBuilders } from './payments';
import { getFilterBuildersForRecordCategories } from './record-categories';

export function getWebshopOrderUIFilterBuilders(preview: PrivateWebshop | WebshopPreview) {
    const builders: UIFilterBuilders = [
        new NumberFilterBuilder({
            name: '#',
            key: 'number',
        }),
        new MultipleChoiceFilterBuilder({
            name: $t(`%1A`),
            options: Object.values(OrderStatus)
                .filter(s => s !== OrderStatus.Deleted)
                .map((status) => {
                    return new MultipleChoiceUIFilterOption(Formatter.capitalizeFirstLetter(OrderStatusHelper.getName(status)), status);
                }),
            wrapper: {
                status: {
                    $in: FilterWrapperMarker,
                },
            },
        }),
        new StringFilterBuilder({
            name: $t(`%1Os`),
            key: 'name',
        }),
        new StringFilterBuilder({
            name: $t(`%1FK`),
            key: 'email',
        }),
    ];

    if (preview.meta.phoneEnabled) {
        builders.push(new StringFilterBuilder({
            name: $t(`%wD`),
            key: 'phone',
        }));
    }

    builders.push(simpleBooleanFilterFactory({
        name: $t('Betaald'),
        optionNames: {
            true: $t('Ja'),
            false: $t('Nee'),
        },
        filterIfTrue: {
            $or: [
                {
                    status: OrderStatus.Canceled
                },
                {
                    status: OrderStatus.Deleted
                },
                {
                    totalPrice: 0
                },
                {
                    balance: {
                        $lte: 0
                    }
                }
            ]
        }
    }));
    
    builders.push(getPaymentGroupFilterBuilder());

    if (preview.meta.checkoutMethods.length > 1) {
        builders.push(new MultipleChoiceFilterBuilder({
            name: $t(`%1Mf`),
            options: preview.meta.checkoutMethods.map((checkoutMethod) => {
                const name = Formatter.capitalizeFirstLetter(`${CheckoutMethodTypeHelper.getName(checkoutMethod.type)}: ${checkoutMethod.name}`);
                return new MultipleChoiceUIFilterOption(name, checkoutMethod.id);
            }),
            wrapper: {
                checkoutMethodId: { $in: FilterWrapperMarker },
            },
        }));
    }

    builders.push(
        new DateFilterBuilder({
            name: $t(`%cB`),
            key: 'validAt',
        }),
        new NumberFilterBuilder({
            name: $t(`%1JL`),
            key: 'totalPrice',
            type: NumberFilterFormat.Currency,
        }),
        new NumberFilterBuilder({
            name: $t(`%M4`),
            key: 'amount',
        }),
    );

    const timeCount = Formatter.uniqueArray(preview.meta.checkoutMethods.flatMap(method => method.timeSlots.timeSlots).map(t => t.timeRangeString())).length;
    const dateCount = Formatter.uniqueArray(preview.meta.checkoutMethods.flatMap(method => method.timeSlots.timeSlots).map(t => t.dateString())).length;

    const hasDelivery = preview.meta.checkoutMethods.some(method => method.type === CheckoutMethodType.Delivery);

    // Count checkoutmethods that are not delivery
    const nonDeliveryCount = preview.meta.checkoutMethods.filter(method => method.type !== CheckoutMethodType.Delivery).length;

    if (dateCount > 1) {
        builders.push(
            new DateFilterBuilder({
                name: (hasDelivery && nonDeliveryCount > 0) ? $t(`%cC`) : (hasDelivery ? $t(`%cD`) : $t(`%cE`)),
                key: 'timeSlotDate',
            }));
    }

    if (timeCount > 1) {
        // todo: change sort of timeSlotTime => should take start time into account => composite key or generated index maybe?
        // todo: maybe group
        builders.push(
            new NumberFilterBuilder({
                name: $t(`%cF`),
                key: 'timeSlotEndTime',
                type: NumberFilterFormat.TimeMinutes,
            }));

        builders.push(
            new NumberFilterBuilder({
                name: $t(`%cG`),
                key: 'timeSlotStartTime',
                type: NumberFilterFormat.TimeMinutes,
            }));
    }

    builders.push(new StringFilterBuilder({
        key: 'code',
        name: $t('%1MX'),
        wrapper: {
            discountCodes: {
                $elemMatch: FilterWrapperMarker,
            },
        },
    }));

    if (preview.hasTickets) {
        builders.push(new MultipleChoiceFilterBuilder({
            name: $t('%1MY'),
            options: preview.hasSingleTickets
                ? [
                        new MultipleChoiceUIFilterOption($t('%1MZ'), 'none'),
                        new MultipleChoiceUIFilterOption($t('%V1'), 'all'),

                    ]
                : [
                        new MultipleChoiceUIFilterOption($t('%1Ma'), 'none'),
                        new MultipleChoiceUIFilterOption($t('%1Mb'), 'partial'),
                        new MultipleChoiceUIFilterOption($t('%1Mc'), 'all'),
                    ],
            wrapper: {
                ticketScanStatus: {
                    $in: FilterWrapperMarker,
                },
            },
        }));

        builders.push(new DateFilterBuilder({
            key: 'ticketScannedAt',
            name: $t('%1Md'),
        }));

        if (!preview.hasSingleTickets) {
            builders.push(new NumberFilterBuilder({
                name: $t('%1Me'),
                key: 'ticketCount',

            }));
        }
    }

    if (preview instanceof Webshop) {
        builders.push(getCartFilterBuilder(preview));
    }

    // Also include complex filters
    builders.push(...getFilterBuildersForRecordCategories(preview.meta.recordCategories));

    const groupFilter = new GroupUIFilterBuilder({ builders });

    return [groupFilter, ...builders];
}


function getPaymentGroupFilterBuilder() {
    const paymentFilterBuilders: UIFilterBuilders = [
        PaymentFilterBuilders.paidAt,
        PaymentFilterBuilders.method,
        PaymentFilterBuilders.price,
        PaymentFilterBuilders.transferDescription,
    ];

    return new GroupUIFilterBuilder({
        name: $t('Betaling(en)'),
        description: $t('Filter op de betaling(en) van de bestelling'),
        builders: paymentFilterBuilders,
        wrapper: {
            payments: {
                $elemMatch: FilterWrapperMarker,
            },
        },
    });
}
