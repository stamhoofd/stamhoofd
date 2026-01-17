import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { AppliedRegistrationDiscount } from '../AppliedRegistrationDiscount.js';
import { compileToInMemoryFilter } from '../filters/InMemoryFilter.js';
import { registrationInMemoryFilterCompilers } from '../filters/inMemoryFilterDefinitions.js';
import { StamhoofdFilter } from '../filters/StamhoofdFilter.js';
import { GenericBalance } from '../GenericBalance.js';
import { Group } from '../Group.js';
import { GroupPrice } from '../GroupSettings.js';
import { StockReservation } from '../StockReservation.js';
import { RegisterItemOption } from './checkout/RegisterItem.js';
import { ObjectWithRecords, PatchAnswers } from './ObjectWithRecords.js';
import { RecordAnswer, RecordAnswerDecoder } from './records/RecordAnswer.js';
import { RecordSettings } from './records/RecordSettings.js';

export class Registration extends AutoEncoder implements ObjectWithRecords {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    // Group price that was chosen
    // @field({ decoder: GroupPrice, version: 266 })
    // groupPrice: GroupPrice

    // options that were chosen
    // @field({ decoder: new ArrayDecoder(RegisterItemOption), version: 266 })
    // options: RegisterItemOption[] = []

    @field({ decoder: Group, version: 266 })
    group: Group;

    @field({ decoder: GroupPrice, version: 305 })
    groupPrice: GroupPrice;

    /**
     * The group price inside a registration is cached and is a snapshot of the group price at the time of registration.
     * This method returns the most up to date group price we can still find.
     */
    get updatedGroupPrice() {
        return this.group.settings.prices.find(price => price.id === this.groupPrice.id) ?? this.groupPrice;
    }

    @field({ decoder: new ArrayDecoder(RegisterItemOption), version: 305 })
    options: RegisterItemOption[] = [];

    @field({ decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder), version: 338 })
    recordAnswers: Map<string, RecordAnswer> = new Map();

    get groupId() {
        return this.group.id;
    }

    @field({ decoder: StringDecoder, version: 250 })
    organizationId: string;

    @field({ decoder: StringDecoder, nullable: true, version: 351 })
    payingOrganizationId: string | null = null;

    @field({ decoder: StringDecoder, version: 300 })
    memberId = '';

    /**
     * @deprecated
     */
    @field({ decoder: IntegerDecoder, optional: true })
    cycle: number = 0;

    /// Set registeredAt to null if the member is on the waiting list for now
    @field({ decoder: DateDecoder, nullable: true })
    registeredAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true, version: 354 })
    startDate: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true, version: 391 })
    endDate: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true, version: 354 })
    trialUntil: Date | null = null;

    /// Keep spot for this member temporarily
    @field({ decoder: DateDecoder, nullable: true })
    reservedUntil: Date | null = null;

    /**
     * Currently not yet used
     */
    @field({ decoder: DateDecoder, nullable: true })
    deactivatedAt: Date | null = null;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date();

    /**
     * @deprecated - replaced by group type
     */
    @field({ decoder: BooleanDecoder, version: 16, optional: true })
    waitingList = false;

    @field({ decoder: BooleanDecoder, version: 20 })
    canRegister = false;

    /**
     * @deprecated
     * Use balances instead
     */
    @field({ decoder: IntegerDecoder, optional: true })
    price = 0;

    /**
     * @deprecated
     * Use balances instead
     */
    @field({ decoder: IntegerDecoder, optional: true })
    pricePaid = 0;

    @field({ decoder: new ArrayDecoder(StockReservation), nullable: true, version: 299 })
    stockReservations: StockReservation[] = [];

    /**
     * The total balance that has been charged for this registration.
     * This includes discounts, and manually adjusted balances.
     */
    @field({ decoder: new ArrayDecoder(GenericBalance), version: 354 })
    balances: GenericBalance[] = [];

    /**
     * Discounts that were applied to this registration.
     * Note that these discounts are saved in separate balance items and
     * are not included in the price.
     *
     * Reason is that discounts can change after you've been registered
     */
    @field({ decoder: new MapDecoder(StringDecoder, AppliedRegistrationDiscount), version: 374 })
    discounts = new Map<string, AppliedRegistrationDiscount>();

    /**
     * @danger this could be glitchy
     * The total price that has been charged for this registration.
     * This includes discounts, and manually adjusted balances.
     *
     * Note: only returns balances that are due now. For trials this can be 0 until the trial becomes payable (± 1 week before the trial ends).
     */
    get calculatedPrice() {
        return this.balances.reduce((sum, r) => sum + (r.amountOpen + r.amountPaid + r.amountPending), 0);
    }

    /**
     * @danger
     * The registration's balances only include the balance items that are due. It is possible in some weird situations that a registration
     * has discounts that are only due in more than a week, in that case, the balance could be:
     * € 0
     * € 40 is due in 2 weeks for the normal price
     * € -10 is due in 2 week for the discount
     * The discounts object will already contain the -10.
     * So this method will return 10 euro instead of €40
     */
    get calculatedPriceWithoutDiscounts() {
        // Discounts have been substracted from the calculated price already, so we have to add them back to get the price without discounts
        return this.calculatedPrice + Array.from(this.discounts.values()).reduce((sum, r) => sum + r.amount, 0);
    }

    get isTrial() {
        return this.trialUntil !== null && (this.deactivatedAt ? (this.trialUntil >= this.deactivatedAt) : (this.trialUntil > new Date()));
    }

    get description() {
        const descriptions: string[] = [];

        if (this.group.settings.getFilteredPrices().length > 1) {
            descriptions.push(this.groupPrice.name.toString());
        }

        for (const option of this.options) {
            descriptions.push(option.optionMenu.name + ': ' + option.option.name + (option.option.allowAmount ? ` x ${option.amount}` : ''));
        }

        for (const answer of this.recordAnswers.values()) {
            descriptions.push(answer.descriptionValue);
        }

        return descriptions.filter(d => !!d).join('\n');
    }

    doesMatchFilter(filter: StamhoofdFilter) {
        try {
            const compiledFilter = compileToInMemoryFilter(filter, registrationInMemoryFilterCompilers);
            return compiledFilter(this);
        }
        catch (e) {
            console.error('Error while compiling filter', e, filter);
        }
        return false;
    }

    isRecordEnabled(_: RecordSettings): boolean {
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return this.recordAnswers;
    }

    patchRecordAnswers(patch: PatchAnswers): this {
        return (this as Registration).patch({
            recordAnswers: patch,
        }) as this;
    }
}
