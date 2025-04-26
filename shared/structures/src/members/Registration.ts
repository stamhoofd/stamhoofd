import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
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

    @field({ decoder: new ArrayDecoder(GenericBalance), version: 354 })
    balances: GenericBalance[] = [];

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
