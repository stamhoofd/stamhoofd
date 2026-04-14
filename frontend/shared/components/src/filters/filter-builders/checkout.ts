import type { RecordCategory, Webshop } from '@stamhoofd/structures';
import { FilterWrapperMarker } from '@stamhoofd/structures';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder, NumberFilterFormat } from '../NumberUIFilter';
import type { UIFilterBuilders } from '../UIFilter';
import { getFilterBuildersForRecordCategories } from './record-categories';

export function getCartFilterBuilder(webshop: Webshop) {
    return new GroupUIFilterBuilder({
        name: $t(`%1DQ`),
        description: $t('%17R'),
        builders: [
            new NumberFilterBuilder({
                name: $t(`%17T`),
                type: NumberFilterFormat.Number,
                key: 'amount',
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`%Sc`),
                options: webshop.products.map((product) => {
                    return new MultipleChoiceUIFilterOption(product.name, product.id);
                }),
                wrapper: {
                    product: {
                        id: {
                            $in: FilterWrapperMarker,
                        },
                    },
                },
            }),
            ...webshop.products.filter(product => product.prices.length > 1).map(product => new MultipleChoiceFilterBuilder({
                name: product.name + ' (' + $t('%17S') + ')',
                options: product.prices.map((price) => {
                    return new MultipleChoiceUIFilterOption(price.name, price.id);
                }),
                wrapper: {
                    product: {
                        id: product.id,
                    },
                    productPrice: {
                        id: {
                            $in: FilterWrapperMarker,
                        },
                    },
                },
            })),
        ],
        wrapper: {
            items: {
                $elemMatch: FilterWrapperMarker,
            },
        },
    });
}

export function useCheckoutInMemoryFilterBuilders() {
    return (webshop: Webshop, categories: RecordCategory[]) => {
        const all: UIFilterBuilders = [
            getCartFilterBuilder(webshop),
        ];

        if (webshop.meta.checkoutMethods.length > 1) {
            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t(`%1Mf`),
                    options: webshop.meta.checkoutMethods.map((method) => {
                        return new MultipleChoiceUIFilterOption(method.typeName + ': ' + method.name, method.id);
                    }),
                    wrapper: {
                        checkoutMethod: {
                            id: {
                                $in: FilterWrapperMarker,
                            },
                        },
                    },
                }),
            );
        }

        // Also include complex filters
        all.push(...getFilterBuildersForRecordCategories(categories));

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };
}
