import { SimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import type { DNSRecord} from '@stamhoofd/structures';
import { DNSRecordStatus, DNSRecordType } from '@stamhoofd/structures';
import { sleep } from '@stamhoofd/utility';
import { Resolver } from 'dns/promises';

export async function validateDNSRecords(dnsRecords: DNSRecord[], didRetry = false) {
    // Revalidate all
    const resolver = new Resolver();
    resolver.setServers(['1.1.1.1', '8.8.8.8', '8.8.4.4']);

    let allValid = true;

    // If all non-TXT records are valid, we can already setup the register domain
    let hasAllNonTXT = true;

    for (const record of dnsRecords) {
        try {
            switch (record.type) {
                case DNSRecordType.CNAME: {
                    const addresses: string[] = await resolver.resolveCname(record.name.substr(0, record.name.length - 1));
                    record.errors = null;

                    if (addresses.length === 0) {
                        record.status = DNSRecordStatus.Pending;

                        if (!record.optional) {
                            allValid = false;
                            hasAllNonTXT = false;

                            record.errors = new SimpleErrors(new SimpleError({
                                code: 'not_found',
                                message: '',
                                human: $t(`%GA`) + ' ' + record.name + ' ' + $t(`%GB`),
                            }));
                        }
                    }
                    else if (addresses.length > 1) {
                        record.status = DNSRecordStatus.Failed;
                        allValid = false;
                        hasAllNonTXT = false;

                        record.errors = new SimpleErrors(new SimpleError({
                            code: 'too_many_fields',
                            message: '',
                            human: $t(`%GC`) + ' ' + record.name + $t(`%GD`),
                        }));
                    }
                    else {
                        if (addresses[0] + '.' === record.value) {
                            record.status = DNSRecordStatus.Valid;
                        }
                        else {
                            record.status = DNSRecordStatus.Failed;

                            if (!record.optional) {
                                allValid = false;
                                hasAllNonTXT = false;

                                record.errors = new SimpleErrors(new SimpleError({
                                    code: 'wrong_value',
                                    message: '',
                                    human: $t(`%GE`) + ' ' + record.name + $t(`%GF`) + ' ' + addresses[0] + '.',
                                }));
                            }
                        }
                    }

                    break;
                }

                case DNSRecordType.TXT: {
                    const records: string[][] = await resolver.resolveTxt(record.name.substr(0, record.name.length - 1));

                    record.errors = null;

                    if (records.length === 0) {
                        record.status = DNSRecordStatus.Pending;

                        if (!record.optional) {
                            allValid = false;

                            record.errors = new SimpleErrors(new SimpleError({
                                code: 'not_found',
                                message: '',
                                human: $t(`%GG`) + ' ' + record.name + ' ' + $t(`%GB`),
                            }));
                        }
                    }
                    else if (records.length > 1) {
                        record.status = DNSRecordStatus.Failed;
                        allValid = false;
                        record.errors = new SimpleErrors(new SimpleError({
                            code: 'too_many_fields',
                            message: '',
                            human: $t(`%GH`) + ' ' + record.name + $t(`%GD`),
                        }));
                    }
                    else {
                        const val = records[0].join('').trim();
                        if (val === record.value.trim()) {
                            record.status = DNSRecordStatus.Valid;
                        }
                        else {
                            record.status = DNSRecordStatus.Failed;

                            if (!record.optional) {
                                allValid = false;

                                record.errors = new SimpleErrors(new SimpleError({
                                    code: 'wrong_value',
                                    message: '',
                                    human: $t(`%GI`) + ' ' + record.name + $t(`%GF`) + ' ' + records[0].join(''),
                                }));
                            }
                        }
                    }
                    break;
                }
            }
        }
        catch (e) {
            record.status = DNSRecordStatus.Pending;

            if (e.code && (e.code === 'ENOTFOUND' || e.code === 'ENODATA')) {
                if (!record.optional) {
                    record.errors = new SimpleErrors(new SimpleError({
                        code: 'not_found',
                        message: '',
                        human: $t(`%GJ`) + ' ' + record.name + ' ' + $t(`%GB`),
                    }));
                }
            }
            else {
                console.error(e);
                if (!record.optional) {
                    record.errors = new SimpleErrors(new SimpleError({
                        code: 'not_found',
                        message: '',
                        human: $t(`%GK`),
                    }));
                }
            }

            if (!record.optional) {
                allValid = false;

                if (record.type !== DNSRecordType.TXT) {
                    hasAllNonTXT = false;
                }
            }
        }
    }

    if (!allValid && !didRetry) {
        // Do a retry once
        await sleep(100);
        return validateDNSRecords(dnsRecords, true);
    }

    return {
        hasAllNonTXT,
        allValid,
    };
}
