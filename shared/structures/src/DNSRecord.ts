import { AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { v4 as uuidv4 } from 'uuid';

export enum DNSRecordType {
    CNAME = 'CNAME',
    TXT = 'TXT',
}

export enum DNSRecordStatus {
    Pending = 'Pending',
    Failed = 'Failed',
    Valid = 'Valid',
}

export class DNSRecord extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(DNSRecordType) })
    type: DNSRecordType;

    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: StringDecoder })
    value: string;

    @field({ decoder: StringDecoder, nullable: true, version: 368 })
    description: string | null = null;

    @field({ decoder: new EnumDecoder(DNSRecordStatus) })
    status: DNSRecordStatus = DNSRecordStatus.Pending;

    @field({ decoder: DateDecoder, defaultValue: () => new Date() })
    createdAt: Date;

    @field({ decoder: SimpleErrors, nullable: true, version: 7 })
    errors: SimpleErrors | null = null;

    @field({ decoder: BooleanDecoder, version: 368 })
    optional = false;
}
