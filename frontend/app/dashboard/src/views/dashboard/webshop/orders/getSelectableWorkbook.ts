import { SelectableColumn } from '@stamhoofd/frontend-excel-export/SelectableColumn';
import { SelectableSheet } from '@stamhoofd/frontend-excel-export/SelectableSheet';
import { SelectableWorkbook } from '@stamhoofd/frontend-excel-export/SelectableWorkbook';
import type { Webshop } from '@stamhoofd/structures';

/**
 *
 * TODO:
 * - support sorting columns in backend (else this will throw)
 */

export function getSelectableWorkbook(webshop: Webshop) {
    const columns: (SelectableColumn) [] = [
        new SelectableColumn({
            id: 'id',
            name: $t('ID bestelling'),
            description: $t(`Unieke identificatie van de bestelling`),
            enabled: false,
        })];

    return new SelectableWorkbook({
        sheets: [
            createOrderLinesSheet(webshop),
            new SelectableSheet({
                id: 'orders',
                name: $t(`%xQ`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t('ID bestelling'),
                        description: $t(`Unieke identificatie van de bestelling`),
                        enabled: false,
                    })],
            }),
            new SelectableSheet({
                id: 'tickets',
                name: $t(`Tickets`),
                columns,
            }),
            new SelectableSheet({
                id: 'totals',
                name: $t(`Totalen`),
                columns,
            }),
        ],
    });
}

function createOrderLinesSheet(webshop: Webshop) {
    // const test = webshop.
    const isEnabled = true;

    function getCategoryIfEnabled(category: string) {
        if (!isEnabled) return undefined;
        return category;
    }

    const Category = {
        Order: $t('Bestelling'),
        Client: $t('Klant'),
        Product: $t('Per artikel'),
        // todo
        Delivery: $t('Levering / afhaling'),
    };

    const columns: SelectableColumn[] = [];

    columns.push(
        new SelectableColumn({
            id: 'number',
            name: $t(`%xA`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Order),
        }),
        new SelectableColumn({
            // todo
            id: 'createdAt',
            name: $t(`%cB`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Order),
        }),

        new SelectableColumn({
            id: 'firstName',
            name: $t(`%1MT`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Client),
        }),
        new SelectableColumn({
            id: 'lastName',
            name: $t(`%1MU`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Client),
        }),
        new SelectableColumn({
            id: 'email',
            name: $t(`%xB`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Client),
        }),
    );

    if (webshop.meta.phoneEnabled) {
        columns.push(new SelectableColumn({
            id: 'phone',
            name: $t(`%18Z`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Client),
        }));
    }

    if (webshop.meta.birthDayEnabled) {
        columns.push(new SelectableColumn({
            id: 'birthDay',
            name: $t(`Geboortedatum`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Client),
        }));
    }

    if (webshop.meta.genderEnabled) {
        columns.push(new SelectableColumn({
            id: 'gender',
            name: $t(`Gender`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Client),
        }));
    }

    if (webshop.meta.addressEnabled) {
        columns.push(new SelectableColumn({
            id: 'address',
            name: $t(`Adres klant`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Client),
        }));
    }

    columns.push( // customerColumnHeaders
        // answerNames

        new SelectableColumn({
            id: 'comments',
            name: $t(`%Ve`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Order),
        }),
        new SelectableColumn({
            // todo
            id: 'amount',
            name: $t(`%M4`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Product),
        }),
        new SelectableColumn({
            // todo
            id: 'price',
            name: $t(`%xC`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Product),
        }),
        new SelectableColumn({
            id: 'extraPrice',
            name: $t(`%xD`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Product),
        }),
        new SelectableColumn({
            id: 'discount',
            name: $t(`%176`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Product),
        }),
        new SelectableColumn({
            // todo
            id: 'totalPrice',
            name: $t(`%1IP`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Product),
        }),
        new SelectableColumn({
            id: 'productName',
            // name: $t(`Naam artikel`),
            name: $t('Naam'),
            enabled: true,
            category: getCategoryIfEnabled(Category.Product),
        }),
        // todo: optionNames
        new SelectableColumn({
            id: 'places',
            name: $t(`%sB`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Product),
        }),

        // duplicates
        new SelectableColumn({
            id: 'deliveryMethod',
            name: $t(`%xE`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Delivery),
        }),
        new SelectableColumn({
            // todo
            id: 'deliveryLocation',
            name: $t(`%xF`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Delivery),
        }),
        new SelectableColumn({
            id: 'deliveryDate',
            name: $t(`%7R`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Delivery),
        }),
        new SelectableColumn({
            id: 'deliveryTime',
            name: $t(`%1GD`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Delivery),
        }),
        new SelectableColumn({
            id: 'paymentMethod',
            name: $t(`%M7`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Order),
        }),
        new SelectableColumn({
            // todo
            id: 'paid',
            // todo
            name: $t(`%1OD`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Order),
        }),
        new SelectableColumn({
            // todo
            id: 'status',
            // todo
            name: $t(`%1A`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Order),

        }),
        new SelectableColumn({
            // todo
            id: 'discountCode',
            // todo
            name: $t(`%1MX`),
            enabled: true,
            category: getCategoryIfEnabled(Category.Order),
        }));

    return new SelectableSheet({
        id: 'orderLines',
        name: $t(`%xP`),
        columns: columns,
    });
}
