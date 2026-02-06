import { Order, Webshop } from '@stamhoofd/models';
import { CheckoutMethodType, PaymentGeneral, PaymentMethod, PaymentMethodHelper, RecordCategory, RecordCheckboxAnswer, WebshopTakeoutMethod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export function createOrderDataHTMLTable(order: Order, webshop: Webshop): string {
    let str = `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><tbody>`;

    const data = [
        {
            title: $t('4d496edf-0203-4df3-a6e9-3e58d226d6c5'),
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
                            title: $t(`f7e792ed-2265-41e9-845f-e3ce0bc5da7c`),
                            value: ((order) => {
                                return (order.data.checkoutMethod as WebshopTakeoutMethod)?.address?.shortString() ?? '';
                            })(order),
                        },
                    ]
                : []
        ),
        {
            title: $t(`40aabd99-0331-4267-9b6a-a87c06b3f7fe`),
            value: Formatter.capitalizeFirstLetter(order.data.timeSlot?.dateString() ?? ''),
        },
        {
            title: $t(`7853cca1-c41a-4687-9502-190849405f76`),
            value: order.data.timeSlot?.timeRangeString() ?? '',
        },
        {
            title: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            value: order.data.customer.name,
        },
        ...(order.data.customer.phone
            ? [
                    {
                        title: $t(`feea3664-9353-4bd4-b17d-aff005d3e265`),
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

export function createPaymentDataHTMLTable(payment: PaymentGeneral): string {
    let str = `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><tbody>`;

    const customer = payment.customer;

    const replacements: { title: string; value: string }[] = [];

    if (customer) {
        replacements.push({
            title: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            value: customer.dynamicName,
        });

        if (customer.phone) {
            replacements.push({
                title: $t(`feea3664-9353-4bd4-b17d-aff005d3e265`),
                value: customer.phone,
            });
        }
    }

    replacements.push({
        title: $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`),
        value: Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(payment.method ?? PaymentMethod.Unknown)),
    });

    replacements.push({
        title: $t(`Totaal`),
        value: Formatter.price(payment.price),
    });

    for (const replacement of replacements) {
        if (replacement.value.length === 0) {
            continue;
        }
        str += `<tr><td><h4>${Formatter.escapeHtml(replacement.title)}</h4></td><td>${Formatter.escapeHtml(replacement.value)}</td></tr>`;
    }

    return str + '</tbody></table>';
}
