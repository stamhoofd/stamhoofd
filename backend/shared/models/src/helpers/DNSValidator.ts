import { SimpleErrors, SimpleError } from "@simonbackx/simple-errors";
import { DNSRecord, DNSRecordStatus, DNSRecordType } from "@stamhoofd/structures";
import { sleep } from "@stamhoofd/utility";

const { Resolver } = require('dns').promises;

export async function validateDNSRecords(dnsRecords: DNSRecord[], didRetry = false) {
     // Revalidate all
    const resolver = new Resolver();
    resolver.setServers(['1.1.1.1', '8.8.8.8', '8.8.4.4']);

    let allValid = true

    // If all non-TXT records are valid, we can already setup the register domain
    let hasAllNonTXT = true

    for (const record of dnsRecords) {
        try {
            switch (record.type) {
                case DNSRecordType.CNAME: {

                    const addresses: string[] = await resolver.resolveCname(record.name.substr(0, record.name.length - 1))
                    record.errors = null;

                    if (addresses.length == 0) {
                        record.status = DNSRecordStatus.Pending
                        allValid = false
                        hasAllNonTXT = false

                        record.errors = new SimpleErrors(new SimpleError({
                            code: "not_found",
                            message: "",
                            human: "We konden de CNAME-record " + record.name + " nog niet vinden. Hou er rekening mee dat het even (tot 24u) kan duren voor we deze kunnen zien."
                        }))
                    } else if (addresses.length > 1) {
                        record.status = DNSRecordStatus.Failed
                        allValid = false
                        hasAllNonTXT = false

                        record.errors = new SimpleErrors(new SimpleError({
                            code: "too_many_fields",
                            message: "",
                            human: "Er zijn meerdere CNAME records ingesteld voor " + record.name + ", kijk na of je er geen moet verwijderen of per ongeluk meerder hebt aangemaakt"
                        }))
                    } else {
                        if (addresses[0] + "." === record.value) {
                            record.status = DNSRecordStatus.Valid
                        } else {
                            record.status = DNSRecordStatus.Failed
                            allValid = false
                            hasAllNonTXT = false

                            record.errors = new SimpleErrors(new SimpleError({
                                code: "wrong_value",
                                message: "",
                                human: "Er is een andere waarde ingesteld voor de CNAME-record " + record.name + ", kijk na of je geen typfout hebt gemaakt. Gevonden: " + addresses[0] + "."
                            }))
                        }
                    }

                    break;
                }

                case DNSRecordType.TXT: {
                    const records: string[][] = await resolver.resolveTxt(record.name.substr(0, record.name.length - 1))

                    record.errors = null;

                    if (records.length == 0) {
                        record.status = DNSRecordStatus.Pending
                        allValid = false

                        record.errors = new SimpleErrors(new SimpleError({
                            code: "not_found",
                            message: "",
                            human: "We konden de TXT-record " + record.name + " nog niet vinden. Hou er rekening mee dat het even (tot 24u) kan duren voor we deze kunnen zien."
                        }))
                    } else if (records.length > 1) {
                        record.status = DNSRecordStatus.Failed
                        allValid = false
                        record.errors = new SimpleErrors(new SimpleError({
                            code: "too_many_fields",
                            message: "",
                            human: "Er zijn meerdere TXT-records ingesteld voor " + record.name + ", kijk na of je er geen moet verwijderen of per ongeluk meerdere hebt aangemaakt"
                        }))
                    } else {
                        const val = records[0].join("").trim()
                        if (val === record.value.trim()) {
                            /*if (records[0].length > 1 && val.length <= 255) {
                                // Split was not needed and is not supported by SES
                                record.status = DNSRecordStatus.Failed
                                allValid = false

                                record.errors = new SimpleErrors(new SimpleError({
                                    code: "wrong_value",
                                    message: "",
                                    human: "De waarde komt overeen maar is op één of andere manier opgesplitst in meerdere stukken, terwijl dat niet nodig is. Dit wordt niet ondersteund door onze e-mailprovider. Contacteer ons als je de oorzaak niet kan achterhalen."
                                }))
                            } else {*/
                                record.status = DNSRecordStatus.Valid
                            //}
                        } else {
                            record.status = DNSRecordStatus.Failed
                            allValid = false

                            record.errors = new SimpleErrors(new SimpleError({
                                code: "wrong_value",
                                message: "",
                                human: "Er is een andere waarde ingesteld voor de TXT-record " + record.name + ", kijk na of je geen typfout hebt gemaakt. Gevonden: " + records[0].join("")
                            }))
                        }
                    }
                    break;
                }

            }
        } catch (e) {
            record.status = DNSRecordStatus.Pending

            if (e.code && (e.code == "ENOTFOUND" || e.code == "ENODATA")) {
                record.errors = new SimpleErrors(new SimpleError({
                    code: "not_found",
                    message: "",
                    human: "We konden de record " + record.name + " nog niet vinden. Hou er rekening mee dat het even (tot 24u) kan duren voor we deze kunnen zien."
                }))
            } else {
                console.error(e)

                record.errors = new SimpleErrors(new SimpleError({
                    code: "not_found",
                    message: "",
                    human: "Er ging iets mis. Deze record lijkt niet goed ingesteld te zijn."
                }))
            }
            allValid = false

            if (record.type !== DNSRecordType.TXT) {
                hasAllNonTXT = false
            }
        }
    }

    if (!allValid && !didRetry) {
        // Do a retry once
        await sleep(100)
        return validateDNSRecords(dnsRecords, true)
    }

    return {
        hasAllNonTXT,
        allValid
    }
}