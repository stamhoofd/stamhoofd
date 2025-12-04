import { AutoEncoder, BooleanDecoder, DateDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';

export class STCredit extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Credits in cents
     */
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    change = 0;

    @field({ decoder: BooleanDecoder, optional: true })
    allowTransactions = false;

    @field({ decoder: StringDecoder })
    description = '';

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder, nullable: true })
    expireAt: Date | null = null;

    static getBalance(credits: STCredit[]) {
        return credits.slice().reverse().reduce((t, c) => {
            if (c.expireAt !== null && c.expireAt < new Date()) {
                return t;
            }

            const l = t + c.change;
            if (l < 0) {
                return 0;
            }
            return l;
        }, 0) ?? 0;
    }
}
