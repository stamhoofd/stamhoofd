import { AutoEncoder, BooleanDecoder, DateDecoder, StringDecoder, field } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

export class RegistrationPeriodBase extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, nullable: true, version: 383 })
    customName: string | null = null;

    @field({ decoder: DateDecoder })
    startDate = new Date();

    @field({ decoder: DateDecoder })
    endDate = new Date();

    @field({ decoder: BooleanDecoder, optional: true })
    locked = false;

    @field({ decoder: StringDecoder, nullable: true, version: 354 })
    previousPeriodId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 382 })
    nextPeriodId: string | null = null;

    get prefix() {
        if (this.customName) {
            const c = this.customName.split(' ');
            if (c.length >= 2 && c[0].length > 2 && c[0].match(/^[a-z]+$/i)) {
                return c[0].trim();
            }
        }

        return $t(`%7Z`);
    }

    get name() {
        if (this.customName) {
            return this.customName;
        }

        if (Formatter.year(this.endDate) === Formatter.year(this.startDate)) {
            return $t(`%7Z`) + ' ' + Formatter.year(this.startDate);
        }

        return $t(`%7Z`) + ' ' + Formatter.year(this.startDate) + ' - ' + Formatter.year(this.endDate);
    }

    get nameShort() {
        if (this.customName) {
            const c = this.customName.split(' ');
            if (c.length >= 2 && c[0].length > 2 && c[0].match(/^[a-z]+$/i)) {
                // Remove prefix from prefix getter
                return c.slice(1).join(' ');
            }
            return this.customName;
        }

        if (Formatter.year(this.endDate) === Formatter.year(this.startDate)) {
            return Formatter.year(this.startDate) + '';
        }

        return Formatter.year(this.startDate) + ' - ' + Formatter.year(this.endDate);
    }

    getDiffValue() {
        return this.name;
    }
}
