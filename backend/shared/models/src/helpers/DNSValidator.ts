import { SimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { DNSRecord, DNSRecordStatus, DNSRecordType } from '@stamhoofd/structures';
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
                                human: $t(`50c67afd-9f29-4634-bbb6-91a6083d7b4b`) + ' ' + record.name + ' ' + $t(`ac374e9b-f59d-4faa-8c12-f4984b798bdd`),
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
                            human: $t(`2cd9734f-c32b-4513-99b5-de749f12cb87`) + ' ' + record.name + $t(`4c66b760-cef1-47bc-899a-1ec5ec363560`),
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
                                    human: $t(`66fa2988-3bef-4e08-9ae8-da904007444e`) + ' ' + record.name + $t(`dbcdb363-81d4-4f74-a484-3f91b2a8bd3d`) + ' ' + addresses[0] + '.',
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
                                human: $t(`55a44a06-c9da-4ba6-a142-9d223636f54b`) + ' ' + record.name + ' ' + $t(`ac374e9b-f59d-4faa-8c12-f4984b798bdd`),
                            }));
                        }
                    }
                    else if (records.length > 1) {
                        record.status = DNSRecordStatus.Failed;
                        allValid = false;
                        record.errors = new SimpleErrors(new SimpleError({
                            code: 'too_many_fields',
                            message: '',
                            human: $t(`f0a3b61f-a736-47f7-b893-1c8c61555b50`) + ' ' + record.name + $t(`4c66b760-cef1-47bc-899a-1ec5ec363560`),
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
                                    human: $t(`3580661b-3a30-4f7f-bb7a-07dfe644957a`) + ' ' + record.name + $t(`dbcdb363-81d4-4f74-a484-3f91b2a8bd3d`) + ' ' + records[0].join(''),
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
                        human: $t(`d6572dda-561a-4aeb-9d9b-1fc4f7a3e337`) + ' ' + record.name + ' ' + $t(`ac374e9b-f59d-4faa-8c12-f4984b798bdd`),
                    }));
                }
            }
            else {
                console.error(e);
                if (!record.optional) {
                    record.errors = new SimpleErrors(new SimpleError({
                        code: 'not_found',
                        message: '',
                        human: $t(`8fdb686d-0a87-477c-a532-dac98afedf43`),
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
