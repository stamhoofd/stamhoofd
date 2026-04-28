import type { Order, Webshop } from '@stamhoofd/models';
import type { WebshopTakeoutMethod } from '@stamhoofd/structures';
import { CheckoutMethodType, PaymentGeneral, PaymentMethod, PaymentMethodHelper, RecordCategory, RecordCheckboxAnswer } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export function createOrderDataHTMLTable(order: Order, webshop: Webshop): string {
    let str = `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><tbody>`;

    const data = [
        {
            title: $t('%xA'),
            value: '' + (order.number ?? '?'),
        },
        {
            title: ((order) => {
                if (order.data.checkoutMethod?.type === CheckoutMethodType.Takeout) {
                    return $t(`%Uq`);
                }

                if (order.data.checkoutMethod?.type === CheckoutMethodType.OnSite) {
                    return $t(`%8a`);
                }

                return $t(`%Us`);
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
                            title: $t(`%Cn`),
                            value: ((order) => {
                                return (order.data.checkoutMethod as WebshopTakeoutMethod)?.address?.shortString() ?? '';
                            })(order),
                        },
                    ]
                : []
        ),
        {
            title: $t(`%7R`),
            value: Formatter.capitalizeFirstLetter(order.data.timeSlot?.dateString() ?? ''),
        },
        {
            title: $t(`%1GD`),
            value: order.data.timeSlot?.timeRangeString() ?? '',
        },
        {
            title: $t(`%1Os`),
            value: order.data.customer.name,
        },
        ...(order.data.customer.phone
            ? [
                    {
                        title: $t(`%18Z`),
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
                            title: $t(`%M7`),
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
