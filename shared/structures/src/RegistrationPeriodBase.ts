import { AutoEncoder, BooleanDecoder, DateDecoder, StringDecoder, field } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

export class RegistrationPeriodBase extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: DateDecoder })
    startDate = new Date();

    @field({ decoder: DateDecoder })
    endDate = new Date();

    @field({ decoder: BooleanDecoder, optional: true })
    locked = false;

    @field({ decoder: StringDecoder, nullable: true, version: 354 })
    previousPeriodId: string | null = null;

    get name() {
        return $t(`Werkjaar`) + ' ' + Formatter.year(this.startDate) + ' - ' + Formatter.year(this.endDate);
    }

    get nameShort() {
        return Formatter.year(this.startDate) + ' - ' + Formatter.year(this.endDate);
    }

    getDiffValue() {
        return this.name;
    }
}
