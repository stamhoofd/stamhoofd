import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { Address } from '../addresses/Address.js';
import { UitpasEventResponse } from '../endpoints/UitpasEventsResponse.js';
import { Image } from '../files/Image.js';
import { ReservedSeat } from '../SeatingPlan.js';
import type { Webshop } from './Webshop.js';
import { WebshopField } from './WebshopField.js';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';

export class ProductPrice extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    /**
     * Price is always in cents, to avoid floating point errors
     */
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    price = 0;

    // Optional: different price if you reach a given amount of pieces (options and prices shouldn't be the same)
    @field({ decoder: IntegerDecoder, nullable: true, version: 93 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, nullable: true })
    discountPrice: number | null = null;

    // Only used if discountPrice is not null
    @field({ decoder: IntegerDecoder, version: 93 })
    discountAmount = 2;

    @field({ decoder: BooleanDecoder, version: 219 })
    hidden = false;

    /**
     * Total stock, excluding already sold items into account
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 221 })
    stock: number | null = null;

    @field({ decoder: IntegerDecoder, version: 221 })
    usedStock = 0;

    /**
     * If this id is not null, this productPrice is the UiTPAS social tariff.
     * In that case it refers to the base price on which the UiTPAS social tariff is applied.
     * If it is null, this is not an UiTPAS social tariff.
     */
    @field({ decoder: StringDecoder, nullable: true, version: 376 })
    uitpasBaseProductPriceId: string | null = null;

    get isSoldOut(): boolean {
        if (this.stock === null) {
            return false;
        }
        return this.usedStock >= this.stock;
    }

    get remainingStock(): number | null {
        if (this.stock === null) {
            return null;
        }
        return Math.max(0, this.stock - this.usedStock);
    }

    clearStock() {
        this.usedStock = 0;
    }
}

export class Option extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    /**
     * Price added (can be negative) is always in cents, to avoid floating point errors
     */
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    price = 0;

    /**
     * Total stock, excluding already sold items into account
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 221 })
    stock: number | null = null;

    @field({ decoder: IntegerDecoder, version: 221 })
    usedStock = 0;

    get isSoldOut(): boolean {
        if (this.stock === null) {
            return false;
        }
        return this.usedStock >= this.stock;
    }

    get remainingStock(): number | null {
        if (this.stock === null) {
            return null;
        }
        return Math.max(0, this.stock - this.usedStock);
    }

    clearStock() {
        this.usedStock = 0;
    }
}

export class OptionMenu extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: BooleanDecoder })
    multipleChoice = false;

    /**
     * By default, we select the first option if multipleChoise is false.
     */
    @field({ decoder: BooleanDecoder, version: 376 })
    autoSelectFirst = true;

    @field({ decoder: new ArrayDecoder(Option) })
    options: Option[] = [
        Option.create({}),
    ];

    clearStock() {
        this.options.forEach(o => o.clearStock());
    }
}

export enum ProductType {
    Product = 'Product',
    Person = 'Person',
    Ticket = 'Ticket',
    Voucher = 'Voucher',
}

/**
 * This includes a location for a ticket (will be visible on the ticket)
 */
export class ProductLocation extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: Address })
    @field({ decoder: Address, nullable: true, version: 146, downgrade: (v) => {
        if (!v) {
            return Address.createDefault();
        }
        return v;
    } })
    address: Address | null = null;

    // TODO: coordinates here (only filled in by backend)
}

/**
 * This includes a time for a ticket (will be visible on the ticket)
 */
export class ProductDateRange extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: DateDecoder })
    startDate = new Date();

    @field({ decoder: DateDecoder })
    endDate = new Date();

    toString() {
        return Formatter.dateRange(this.startDate, this.endDate);
    }
}

export class Product extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    description = '';

    @field({ decoder: BooleanDecoder })
    enabled = true;

    @field({ decoder: BooleanDecoder, version: 172 })
    hidden = false;

    /**
     * Allow to order multiple pieces of the same product combination
     */
    @field({ decoder: BooleanDecoder, version: 173 })
    allowMultiple = true;

    /**
     * Only allow one piece per product combination
     */
    @field({ decoder: BooleanDecoder, version: 173 })
    unique = false;

    @field({ decoder: DateDecoder, nullable: true, version: 172 })
    enableAfter: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true, version: 172 })
    disableAfter: Date | null = null;

    get isEnabled() {
        return this.enabled && !this.hidden && (!this.enableAfter || this.enableAfter <= new Date()) && (!this.disableAfter || this.disableAfter >= new Date());
    }

    get enableInFuture() {
        return this.enabled && !this.hidden && this.enableAfter !== null && this.enableAfter > new Date() && (!this.disableAfter || this.disableAfter >= new Date());
    }

    get isTicket() {
        return this.type === ProductType.Ticket || this.type === ProductType.Voucher;
    }

    @field({ decoder: new ArrayDecoder(Image) })
    images: Image[] = [];

    @field({ decoder: new ArrayDecoder(WebshopField), version: 94 })
    customFields: WebshopField[] = [];

    @field({ decoder: new EnumDecoder(ProductType) })
    type = ProductType.Product;

    @field({ decoder: ProductLocation, nullable: true, version: 105 })
    location: ProductLocation | null = null;

    @field({ decoder: ProductDateRange, nullable: true, version: 105 })
    dateRange: ProductDateRange | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 211 })
    seatingPlanId: string | null = null;

    @field({ decoder: new ArrayDecoder(ReservedSeat), nullable: true, version: 211 })
    reservedSeats: ReservedSeat[] = [];

    /**
     * WIP: not yet supported
     * Set to true if you need to have a name for every ordered product. When this is true, you can't order this product mutliple times with the same name.
     * + will validate the name better
     */
    @field({ decoder: BooleanDecoder, optional: true })
    askName = false;

    /**
     * Maximum amount per order
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 171 })
    maxPerOrder: number | null = null;

    /**
     * Only show available stock if going below this amount - or null to always show the stock.
     */
    @field({ decoder: IntegerDecoder, nullable: true, optional: true })
    showStockBelow: number | null = 25;

    /**
     * Total stock, excluding already sold items into account
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    stock: number | null = null;

    @field({ decoder: IntegerDecoder })
    usedStock = 0;

    /**
     * All the prices of this product (e.g. small, medium, large), should contain at least one price.
     */
    @field({
        decoder: new ArrayDecoder(ProductPrice),
        defaultValue: () => [
            ProductPrice.create({
                name: '',
                price: 0,
            }),
        ],
    })
    prices: ProductPrice[];

    @field({ decoder: new ArrayDecoder(OptionMenu) })
    optionMenus: OptionMenu[] = [];

    /**
     * If this id is not null, we use the official UiTPAS flow.
     * If it is null, we use the non-official flow (if one of the productPrices is UiTPAS social tariff
     */
    @field({ decoder: UitpasEventResponse, nullable: true, version: 378 })
    uitpasEvent: UitpasEventResponse | null = null;

    clearStock() {
        this.usedStock = 0;
        this.reservedSeats = [];
        this.optionMenus.forEach(o => o.clearStock());
        this.prices.forEach(p => p.clearStock());
    }

    get isSoldOut(): boolean {
        return this.remainingStockWithOptions === 0;
    }

    /**
     * Only accounts for the stock of the product itself, not the stock of the options
     */
    get remainingStock(): number | null {
        if (this.stock === null) {
            return null;
        }
        return Math.max(0, this.stock - this.usedStock);
    }

    /**
     * Accounts for options and prices too
     */
    get remainingStockWithOptions(): number | null {
        const stocks: number[] = [];

        if (this.remainingStock !== null) {
            stocks.push(this.remainingStock);
        }

        let priceStocks: number[] = [];

        for (const price of this.prices) {
            if (price.remainingStock !== null) {
                priceStocks.push(price.remainingStock);
            }
            else {
                // Infinite stock for at least one price = no price stock
                priceStocks = [];
                break;
            }
        }

        if (priceStocks.length) {
            stocks.push(Math.max(...priceStocks));
        }

        for (const menu of this.optionMenus) {
            if (!menu.multipleChoice) {
                // Required to pick one
                // We need to pick the maximum of the option stock
                let menuStocks: number[] = [];
                for (const option of menu.options) {
                    if (option.remainingStock !== null) {
                        menuStocks.push(option.remainingStock);
                    }
                    else {
                        // Infinite stock for at least one option = no menu stock
                        menuStocks = [];
                        break;
                    }
                }

                if (menuStocks.length) {
                    stocks.push(Math.max(...menuStocks));
                }
            }
        }

        if (stocks.length === 0) {
            return null;
        }

        return Math.min(...stocks);
    }

    get hasAnyStock(): boolean {
        if (this.remainingStock !== null) {
            return true;
        }

        for (const price of this.prices) {
            if (price.remainingStock !== null) {
                return true;
            }
        }

        for (const menu of this.optionMenus) {
            // Required to pick one
            // We need to pick the maximum of the option stock
            for (const option of menu.options) {
                if (option.remainingStock !== null) {
                    return true;
                }
            }
        }

        return false;
    }

    getRemainingSeats(webshop: Webshop, isAdmin: boolean): number | null {
        if (this.seatingPlanId === null) {
            return null;
        }
        const seatingPlan = webshop.meta.seatingPlans.find(p => p.id === this.seatingPlanId);
        if (!seatingPlan) {
            return null;
        }

        if (isAdmin) {
            return seatingPlan.seatCount - this.reservedSeats.length;
        }

        return seatingPlan.seatCount - seatingPlan.adminSeatCount - this.reservedSeats.filter(r => !seatingPlan.isAdminSeat(r)).length;
    }

    /**
     * Whether it is not possibel to add multiple different items of this product to the cart, or whether this product supports multiple items in the cart.
     * Controls whether cart is edited by default or updated when clicking it open in the webshop.
     */
    get isUnique() {
        if (this.maxPerOrder === 1) {
            return true;
        }

        // No choice options
        if (this.optionMenus.length === 0 && this.prices.length <= 1 && this.customFields.length === 0) {
            return true;
        }

        return false;
    }

    getRemainingStockText(stock: number): string {
        if (stock === 1) {
            if (this.type === ProductType.Ticket) {
                return $t(`%t9`);
            }
            if (this.type === ProductType.Person) {
                return $t(`%tA`);
            }
            return $t(`%tB`);
        }

        if (this.type === ProductType.Ticket) {
            return stock + ' ' + $t(`%m`);
        }

        if (this.type === ProductType.Person) {
            return stock + ' ' + $t(`%12R`);
        }
        return stock + ' ' + $t(`%12S`);
    }

    get stockText(): string | null {
        if (this.remainingStockWithOptions === null || this.remainingStockWithOptions > 25) {
            return null;
        }

        if (this.remainingStockWithOptions === 0) {
            return $t(`%12p`);
        }

        return $t(`%Un`) + ' ' + this.getRemainingStockText(this.remainingStockWithOptions);
    }

    get isEnabledTextLong() {
        if (this.hidden) {
            return $t(`%UC`);
        }

        if (!this.enabled) {
            return $t(`%Tk`);
        }

        if (this.enableInFuture && this.enableAfter) {
            if (this.disableAfter) {
                return $t(`%tC`) + ' ' + Formatter.dateTime(this.enableAfter) + ' ' + $t(`%10C`) + ' ' + Formatter.dateTime(this.disableAfter);
            }
            return $t(`%tC`) + ' ' + Formatter.dateTime(this.enableAfter);
        }

        if (!this.isEnabled) {
            return $t(`%Tk`);
        }

        if (this.disableAfter) {
            return $t(`%tD`) + ' ' + Formatter.dateTime(this.disableAfter);
        }
    }

    get closesSoonText(): string | null {
        if (!this.isEnabled) {
            return null;
        }

        if (this.disableAfter) {
            const diff = this.disableAfter.getTime() - new Date().getTime();
            if (diff < 24 * 60 * 60 * 1000) {
                return $t(`%tD`) + ' ' + Formatter.time(this.disableAfter);
            }
        }
        return null;
    }

    filteredPrices(options: { admin: boolean }): ProductPrice[] {
        if (options.admin) {
            return this.prices;
        }

        return this.prices.filter(p => !p.hidden);
    }
}
