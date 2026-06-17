import { ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';

import { Group } from './Group.js';
import { GroupGenderType } from './GroupGenderType.js';
import { GroupPrice, GroupSettings, WaitingListType } from './GroupSettings.js';
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
    function buildGroup(options: { maxMembers?: number | null; prices: GroupPrice[]; usedGroupStock?: number; usedPriceStock?: Record<string, number> }) {
        const settings = GroupSettings.create({
            name: TranslatedString.create('Naam'),
            maxMembers: options.maxMembers ?? null,
            prices: options.prices,
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

        return Group.create({ settings, stockReservations });
    }

    describe('getRemainingPricesStock', () => {
        it('returns null when no price has a stock limit', () => {
            const group = buildGroup({
                prices: [
                    GroupPrice.create({ stock: null }),
                    GroupPrice.create({ stock: null }),
                ],
            });
            expect(group.settings.getRemainingPricesStock(group)).toBeNull();
        });

        it('returns null when at least one selectable price has unlimited stock', () => {
            const group = buildGroup({
                prices: [
                    GroupPrice.create({ stock: 3 }),
                    GroupPrice.create({ stock: null }),
                ],
            });
            expect(group.settings.getRemainingPricesStock(group)).toBeNull();
        });

        it('returns the maximum remaining stock across prices', () => {
            const group = buildGroup({
                prices: [
                    GroupPrice.create({ stock: 3 }),
                    GroupPrice.create({ stock: 10 }),
                ],
            });
            expect(group.settings.getRemainingPricesStock(group)).toBe(10);
        });

        it('takes used stock per price into account', () => {
            const priceA = GroupPrice.create({ stock: 3 });
            const priceB = GroupPrice.create({ stock: 10 });
            const group = buildGroup({
                prices: [priceA, priceB],
                usedPriceStock: { [priceA.id]: 1, [priceB.id]: 8 },
            });
            // priceA remaining 2, priceB remaining 2 -> max 2
            expect(group.settings.getRemainingPricesStock(group)).toBe(2);
        });

        it('ignores hidden prices', () => {
            const group = buildGroup({
                prices: [
                    GroupPrice.create({ stock: 100, hidden: true }),
                    GroupPrice.create({ stock: 5 }),
                ],
            });
            expect(group.settings.getRemainingPricesStock(group)).toBe(5);
        });
    });

    describe('getRemainingStockIncludingPrices', () => {
        it('returns null when neither group nor prices impose a limit', () => {
            const group = buildGroup({
                maxMembers: null,
                prices: [GroupPrice.create({ stock: null })],
            });
            expect(group.settings.getRemainingStockIncludingPrices(group)).toBeNull();
        });

        it('returns the price stock when the group has no limit', () => {
            const group = buildGroup({
                maxMembers: null,
                prices: [GroupPrice.create({ stock: 4 })],
            });
            expect(group.settings.getRemainingStockIncludingPrices(group)).toBe(4);
        });

        it('returns the group stock when no price has a limit', () => {
            const group = buildGroup({
                maxMembers: 6,
                prices: [GroupPrice.create({ stock: null })],
            });
            expect(group.settings.getRemainingStockIncludingPrices(group)).toBe(6);
        });

        it('returns the minimum of group and price stock', () => {
            const group = buildGroup({
                maxMembers: 10,
                prices: [
                    GroupPrice.create({ stock: 2 }),
                    GroupPrice.create({ stock: 3 }),
                ],
            });
            // group 10, max price stock 3 -> 3
            expect(group.settings.getRemainingStockIncludingPrices(group)).toBe(3);
        });

        it('returns the group stock when it is lower than the price stock', () => {
            const group = buildGroup({
                maxMembers: 2,
                prices: [GroupPrice.create({ stock: 8 })],
            });
            expect(group.settings.getRemainingStockIncludingPrices(group)).toBe(2);
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
