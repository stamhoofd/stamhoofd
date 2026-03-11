import { Order, Webshop } from '@stamhoofd/models';
import { CheckoutMethodType, PaymentGeneral, PaymentMethod, PaymentMethodHelper, RecordCategory, RecordCheckboxAnswer, WebshopTakeoutMethod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export function createOrderDataHTMLTable(order: Order, webshop: Webshop): string {
    let str = `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><tbody>`;

    const data = [
        {
            title: $t('17772225-f9c0-4707-9e2a-97f94de4e9d0'),
            value: '' + (order.number ?? '?'),
        },
        {
            title: ((order) => {
                if (order.data.checkoutMethod?.type === CheckoutMethodType.Takeout) {
                    return $t(`8113733b-00ea-42ae-8829-6056774a8be0`);
                }

                if (order.data.checkoutMethod?.type === CheckoutMethodType.OnSite) {
                    return $t(`7eec15d0-4d60-423f-b860-4f3824271578`);
                }

                return $t(`8a910c54-1b2d-4963-9128-2cab93b0151b`);
            })(order),
            value: ((order) => {
                if (order.data.checkoutMethod?.type === CheckoutMethodType.Takeout) {
                    return order.data.checkoutMethod.name;
                }

                if (order.data.checkoutMethod?.type === CheckoutMethodType.OnSite) {
                    return order.data.checkoutMethod.name;
                }

                return order.data.address?.shortString() ?? '';
            })(order),
        },
        ...(
            (order.data.checkoutMethod?.type === CheckoutMethodType.Takeout || order.data.checkoutMethod?.type === CheckoutMethodType.OnSite) && ((order.data.checkoutMethod as any)?.address)
                ? [
                        {
                            title: $t(`0a37de09-120b-4bea-8d13-6d7ed6823884`),
                            value: ((order) => {
                                return (order.data.checkoutMethod as WebshopTakeoutMethod)?.address?.shortString() ?? '';
                            })(order),
                        },
                    ]
                : []
        ),
        {
            title: $t(`112b7686-dffc-4ae9-9706-e3efcd34898f`),
            value: Formatter.capitalizeFirstLetter(order.data.timeSlot?.dateString() ?? ''),
        },
        {
            title: $t(`5a3e25de-683f-4a20-b02e-ebcc3aca89f6`),
            value: order.data.timeSlot?.timeRangeString() ?? '',
        },
        {
            title: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            value: order.data.customer.name,
        },
        ...(order.data.customer.phone
            ? [
                    {
                        title: $t(`3174ba16-f035-4afd-a69f-74865e64ef34`),
                        value: order.data.customer.phone,
                    },
                ]
            : []),
        ...order.data.fieldAnswers.filter(a => a.answer).map(a => ({
            title: a.field.name,
            value: a.answer,
        })),
        ...RecordCategory.sortAnswers(order.data.recordAnswers, webshop.meta.recordCategories).filter(a => !a.isEmpty || a instanceof RecordCheckboxAnswer).map(a => ({
            title: a.settings.name.toString(),
            value: a.stringValue,
        })),
        ...(
            (order.data.paymentMethod !== PaymentMethod.Unknown)
                ? [
                        {
                            title: $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`),
                            value: Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(order.data.paymentMethod)),
                        },
                    ]
                : []
        ),
        ...order.data.priceBreakown.map((p) => {
            return {
                title: p.name,
                value: Formatter.price(p.price),
            };
        }),
    ];

    for (const replacement of data) {
        if (replacement.value.length === 0) {
            continue;
        }
        str += `<tr><td><h4>${Formatter.escapeHtml(replacement.title)}</h4></td><td>${Formatter.escapeHtml(replacement.value)}</td></tr>`;
    }

    return str + '</tbody></table>';
}
