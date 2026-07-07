import { ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';

import { Group } from './Group.js';
import { GroupGenderType } from './GroupGenderType.js';
import { GroupOption, GroupOptionMenu, GroupPrice, GroupSettings, WaitingListType } from './GroupSettings.js';
import { StockReservation } from './StockReservation.js';
import { TranslatedString } from './TranslatedString.js';

describe('GroupSettings v73 → v75 upgrade', () => {
    it('should remove max members if not used', () => {
        const pre = new Date();
        const data = {
            name: '',
            description: '',
            startDate: new Date().getTime(),
            endDate: new Date().getTime(),
            registrationStartDate: new Date().getTime(),
            registrationEndDate: new Date().getTime(),
            prices: [],
            genderType: GroupGenderType.Mixed,
            minAge: null,
            maxAge: null,
            waitingListType: WaitingListType.None,
            preRegistrationsDate: null,
            maxMembers: 20,
            priorityForFamily: true,
            images: [],
            coverPhoto: null,
            squarePhoto: null,
        };

        const objectData = new ObjectData(data, { version: 73 });
        expect(objectData.decode(GroupSettings)).toMatchObject({
            preRegistrationsDate: null,
            maxMembers: null,
            waitingListType: WaitingListType.None,
        });
    });
});

describe('GroupSettings stock', () => {
    function buildGroup(options: { maxMembers?: number | null; prices: GroupPrice[]; usedGroupStock?: number; usedPriceStock?: Record<string, number>; optionMenus?: GroupOptionMenu[]; usedOptionStock?: Record<string, number> }) {
        const settings = GroupSettings.create({
            name: TranslatedString.create('Naam'),
            maxMembers: options.maxMembers ?? null,
            prices: options.prices,
            optionMenus: options.optionMenus ?? [],
        });

        const stockReservations: StockReservation[] = [];

        if (options.usedGroupStock) {
            stockReservations.push(StockReservation.create({
                objectId: '',
                objectType: 'GroupPrice',
                amount: options.usedGroupStock,
            }));
        }

        for (const [priceId, amount] of Object.entries(options.usedPriceStock ?? {})) {
            stockReservations.push(StockReservation.create({
                objectId: priceId,
                objectType: 'GroupPrice',
                amount,
            }));
        }

        for (const [optionId, amount] of Object.entries(options.usedOptionStock ?? {})) {
            stockReservations.push(StockReservation.create({
                objectId: optionId,
                objectType: 'GroupOption',
                amount,
            }));
        }

        return Group.create({ settings, stockReservations });
    }

    describe('getTotalRemainingPricesStock', () => {
        it('returns null when no price has a stock limit', () => {
            const group = buildGroup({
                prices: [
                    GroupPrice.create({ stock: null }),
                    GroupPrice.create({ stock: null }),
                ],
            });
            expect(group.settings.getTotalRemainingPricesStock(group)).toBeNull();
        });

        it('returns null when at least one selectable price has unlimited stock', () => {
            const group = buildGroup({
                prices: [
                    GroupPrice.create({ stock: 3 }),
                    GroupPrice.create({ stock: null }),
                ],
            });
            expect(group.settings.getTotalRemainingPricesStock(group)).toBeNull();
        });

        it('returns the total remaining stock across prices', () => {
            const group = buildGroup({
                prices: [
                    GroupPrice.create({ stock: 3 }),
                    GroupPrice.create({ stock: 10 }),
                ],
            });
            expect(group.settings.getTotalRemainingPricesStock(group)).toBe(13);
        });

        it('takes used stock per price into account', () => {
            const priceA = GroupPrice.create({ stock: 3 });
            const priceB = GroupPrice.create({ stock: 10 });
            const group = buildGroup({
                prices: [priceA, priceB],
                usedPriceStock: { [priceA.id]: 1, [priceB.id]: 8 },
            });
            // priceA remaining 2, priceB remaining 2 -> total 4
            expect(group.settings.getTotalRemainingPricesStock(group)).toBe(4);
        });

        it('ignores hidden prices', () => {
            const group = buildGroup({
                prices: [
                    GroupPrice.create({ stock: 100, hidden: true }),
                    GroupPrice.create({ stock: 5 }),
                ],
            });
            expect(group.settings.getTotalRemainingPricesStock(group)).toBe(5);
        });
    });

    describe('getTotalRemainingMenuOptionsStock', () => {
        it('returns an empty array when no option has a stock limit', () => {
            const group = buildGroup({
                prices: [],
                optionMenus: [
                    GroupOptionMenu.create({ options: [
                        GroupOption.create({ stock: null }),
                        GroupOption.create({ stock: null }),
                    ] }),
                    GroupOptionMenu.create({ options: [
                        GroupOption.create({ stock: null }),
                    ] }),
                ],
            });
            expect(group.settings.getTotalRemainingMenuOptionsStock(group)).toHaveLength(0);
        });

        it('does not return an item for a menu with at least one option that has no stock limit', () => {
            const group = buildGroup({
                prices: [],
                optionMenus: [
                    GroupOptionMenu.create({ options: [
                        GroupOption.create({ stock: 3 }),
                        GroupOption.create({ stock: null }),
                    ],
                    }),
                    GroupOptionMenu.create({ options: [
                        GroupOption.create({ stock: 3 }),
                        GroupOption.create({ stock: 5 }),
                    ],
                    }),
                ],
            });
            expect(group.settings.getTotalRemainingMenuOptionsStock(group)).toHaveLength(1);
        });

        it('returns the total remaining stock per menu', () => {
            const group = buildGroup({
                prices: [
                ],
                optionMenus: [
                    GroupOptionMenu.create({ options: [
                        GroupOption.create({ stock: 3 }),
                        GroupOption.create({ stock: 10 }),
                    ],
                    }),
                    GroupOptionMenu.create({ options: [
                        GroupOption.create({ stock: 3 }),
                        GroupOption.create({ stock: 5 }),
                    ],
                    }),
                ],
            });
            const result = group.settings.getTotalRemainingMenuOptionsStock(group);
            expect(result).toHaveLength(2);
            expect(result[0]).toBe(13);
            expect(result[1]).toBe(8);
        });

        it('takes used stock per option into account', () => {
            const option1 = GroupOption.create({ stock: 3 });
            const option2 = GroupOption.create({ stock: 10 });
            const option3 = GroupOption.create({ stock: 10 });
            const option4 = GroupOption.create({ stock: 10 });

            const group = buildGroup({
                prices: [],
                optionMenus: [
                    GroupOptionMenu.create({ options: [
                        option1,
                        option2,
                    ],
                    }),
                    GroupOptionMenu.create({ options: [
                        option3,
                        option4,
                    ],
                    }),
                ],
                usedOptionStock: { [option1.id]: 1, [option2.id]: 3, [option3.id]: 5, [option4.id]: 7 },
            });

            const result = group.settings.getTotalRemainingMenuOptionsStock(group);

            expect(result).toHaveLength(2);
            expect(result[0]).toBe(9);
            expect(result[1]).toBe(8);
        });

        it('ignores hidden options', () => {
            const group = buildGroup({
                prices: [
                ],
                optionMenus: [
                    GroupOptionMenu.create({ options: [
                        GroupOption.create({ stock: 100, hidden: true }),
                        GroupOption.create({ stock: 5 }),
                    ],
                    }),
                ],
            });
            expect(group.settings.getTotalRemainingMenuOptionsStock(group)[0]).toBe(5);
        });
    });

    describe('getRemainingStockIncludingPricesAndOptions', () => {
        it('returns null if no group, price or option limits are set', () => {
            const group = buildGroup({
                maxMembers: null,
                prices: [GroupPrice.create({ stock: null })],
                optionMenus: [
                    GroupOptionMenu.create({ options: [GroupOption.create({ stock: null })] }),
                    GroupOptionMenu.create({ options: [GroupOption.create({ stock: null }), GroupOption.create({ stock: null })] }),
                ],
            });

            expect(group.settings.getRemainingStockIncludingPricesAndOptions(group)).toBeNull();
        });

        it('returns the price stock when the group has no limit and no options are set', () => {
            const group = buildGroup({
                maxMembers: null,
                prices: [GroupPrice.create({ stock: 4 })],
            });
            expect(group.settings.getRemainingStockIncludingPricesAndOptions(group)).toBe(4);
        });

        it('returns the group stock when no price has a limit and no options are set', () => {
            const group = buildGroup({
                maxMembers: 6,
                prices: [GroupPrice.create({ stock: null })],
            });
            expect(group.settings.getRemainingStockIncludingPricesAndOptions(group)).toBe(6);
        });

        it('returns the minimum of group and price stock if no options are set', () => {
            const group = buildGroup({
                maxMembers: 10,
                prices: [
                    GroupPrice.create({ stock: 2 }),
                    GroupPrice.create({ stock: 3 }),
                ],
            });
            // group 10, max price stock 3 -> 3
            expect(group.settings.getRemainingStockIncludingPricesAndOptions(group)).toBe(5);
        });

        it('returns the group stock when it is lower than the price stock and no options are set', () => {
            const group = buildGroup({
                maxMembers: 2,
                prices: [GroupPrice.create({ stock: 8 })],
            });
            expect(group.settings.getRemainingStockIncludingPricesAndOptions(group)).toBe(2);
        });

        it('returns the lowest of all limits', () => {
            const group = buildGroup({
                maxMembers: 20,
                prices: [GroupPrice.create({ stock: 15 })],
                optionMenus: [
                    // lowest limit -> will be taken
                    GroupOptionMenu.create({ options: [GroupOption.create({ stock: 1 }), GroupOption.create({ stock: 2 })] }),
                    // will be ignored
                    GroupOptionMenu.create({ options: [GroupOption.create({ stock: null }), GroupOption.create({ stock: null })] }),
                ],
            });

            expect(group.settings.getRemainingStockIncludingPricesAndOptions(group)).toBe(3);
        });
    });
});
describe('GroupSettings.validateName', () => {
    it('throws for empty group names', () => {
        const emptyNames = [
            '',
            '   ',
            '\t\n',
            '\u00A0',
            '\u200B\u200C\u200D',
        ];

        for (const name of emptyNames) {
            const settings = GroupSettings.create({
                name: TranslatedString.create(name),
            });

            expect(() => settings.validateName()).toThrow(SimpleError);
        }
    });

    it('normalizes whitespace', () => {
        const settings = GroupSettings.create({
            name: TranslatedString.create('  Test\u200Bgroep  '),
        });

        settings.validateName();

        expect(settings.name.toString()).toBe('Test groep');
    });

    it('throws for names with an empty slug', () => {
        const settings = GroupSettings.create({
            name: TranslatedString.create('🎉'),
        });

        expect(() => settings.validateName()).toThrow(SimpleError);
    });
});
