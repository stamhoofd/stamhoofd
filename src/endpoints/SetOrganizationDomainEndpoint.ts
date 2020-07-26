import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { DNSRecord, DNSRecordStatus, DNSRecordType, Organization as OrganizationStruct,OrganizationDomains } from "@stamhoofd/structures";
import SES from 'aws-sdk/clients/sesv2';
const { Resolver } = require('dns').promises;
import { add } from 'libsodium-wrappers';
import NodeRSA from 'node-rsa';

import { Organization } from '../models/Organization';
import { Token } from '../models/Token';
import { UserWithOrganization } from '../models/User';

type Params = {};
type Query = undefined;
type Body = OrganizationDomains;
type ResponseBody = OrganizationStruct

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class SetOrganizationDomainEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = OrganizationDomains as Decoder<OrganizationDomains>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/domain", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }

        const errors = new SimpleErrors()

        const organization = token.user.organization

        // check if changed
        if (
            organization.registerDomain !== request.body.registerDomain  // changed register domain
            || (organization.privateMeta.pendingMailDomain !== request.body.mailDomain && organization.privateMeta.mailDomain !== request.body.mailDomain)  // changed pending domain
        ) {
            console.log("Domains changed")

            // Validate domains
            // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
            if (request.body.registerDomain !== null && !request.body.registerDomain.match(/^[a-zA-Z0-9]+\.[a-zA-Z0-9]+\.[a-zA-Z]+$/)) {
                throw new SimpleError({
                    code: "invalid_domain",
                    message: "registerDomain is invalid",
                    human: "De subdomeinnaam voor jouw registratiepagina is ongeldig",
                    field: "registerDomain"
                })
            }
            
            // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
            if (request.body.mailDomain !== null && !request.body.mailDomain.match(/^[a-zA-Z0-9]+\.[a-zA-Z]+$/)) {
                throw new SimpleError({
                    code: "invalid_domain",
                    message: "mailDomain is invalid",
                    human: "De domeinnaam voor e-mails is ongeldig",
                    field: "mailDomain"
                })
            }

            organization.registerDomain = request.body.registerDomain

            organization.privateMeta.pendingMailDomain = request.body.mailDomain
            organization.privateMeta.mailDomain = null

            // Generate new DNS-records
            organization.privateMeta.dnsRecords = []

            if (organization.registerDomain || request.body.mailDomain) {
                // CNAME domain: for SPF + MX + A record
                organization.privateMeta.dnsRecords.push(DNSRecord.create({
                    type: DNSRecordType.CNAME,
                    name: organization.registerDomain+".",
                    value: "domains."+process.env.HOSTNAME!+"."
                }))
            }

            if (request.body.mailDomain !== null) {

                let priv: string
                let pub: string

                if (!organization.serverMeta.privateDKIMKey || !organization.serverMeta.publicDKIMKey ) {
                    const key = new NodeRSA({ b: 1024 }); // AWS SES doesn't support 2048 yet
                    const privArr = (key.exportKey('private') as string).split("\n")
                    priv = privArr.splice(1, privArr.length - 2).join("");

                    const pubArr = (key.exportKey('public') as string).split("\n")
                    pub = pubArr.splice(1, pubArr.length - 2).join("");

                    organization.serverMeta.privateDKIMKey = priv
                    organization.serverMeta.publicDKIMKey = pub
                } else {
                    priv = organization.serverMeta.privateDKIMKey
                    pub = organization.serverMeta.publicDKIMKey
                }
               
                console.log(priv)
                console.log(pub)

                // DKIM records
                organization.privateMeta.dnsRecords.push(DNSRecord.create({
                    type: DNSRecordType.TXT,
                    name: "stamhoofd._domainkey." + request.body.mailDomain + ".",
                    value: "v=DKIM1; k=rsa; p=" + pub + ""
                }))
            }

            await organization.save()

        } else {
            // Validate DNS-records if not empty
            console.log("Validating domains")

            let isValidRecords = true
            for(const record of organization.privateMeta.dnsRecords) {
                if (record.status != DNSRecordStatus.Valid) {
                    isValidRecords = false
                }
            }

            if (!isValidRecords) {
                await this.updateDNSRecords(user)
            }
        }

        console.log("Done.")
        
        errors.throwIfNotEmpty()
        return new Response(await user.getOrganizatonStructure(organization));
    }

    async updateDNSRecords(user: UserWithOrganization) {
        const organization = user.organization

        // Revalidate all
        const resolver = new Resolver();
        resolver.setServers(Math.random() > 0.5 ? ['1.1.1.1', '8.8.8.8'] : ['8.8.8.8', '1.1.1.1']);

        let allValid = true
        for (const record of organization.privateMeta.dnsRecords) {
            if (record.status != DNSRecordStatus.Valid) {
                try {
                    switch (record.type) {
                        case DNSRecordType.CNAME: {
                            
                            const addresses: string[] = await resolver.resolveCname(record.name.substr(0, record.name.length - 1))
                            record.errors = null;

                            if (addresses.length == 0) {
                                record.status = DNSRecordStatus.Pending
                                allValid = false
                            } else if (addresses.length > 1) {
                                record.status = DNSRecordStatus.Failed
                                allValid = false

                                record.errors = new SimpleErrors(new SimpleError({
                                    code: "too_many_fields",
                                    message: "",
                                    human: "Er zijn meerdere CNAME records ingesteld voor " + record.name + ", kijk na of je er geen moet verwijderen of per ongeluk meerder hebt aangemaakt"
                                }))
                            } else {
                                if (addresses[0]+"." === record.value) {
                                    record.status = DNSRecordStatus.Valid
                                } else {
                                    record.status = DNSRecordStatus.Failed
                                    allValid = false

                                    record.errors = new SimpleErrors(new SimpleError({
                                        code: "wrong_value",
                                        message: "",
                                        human: "Er is een andere waarde ingesteld voor de CNAME-record " + record.name + ", kijk na of je geen typfout hebt gemaakt. Gevonden: "+addresses[0]+"."
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
                            } else if (records.length > 1) {
                                record.status = DNSRecordStatus.Failed
                                allValid = false
                                record.errors = new SimpleErrors(new SimpleError({
                                    code: "too_many_fields",
                                    message: "",
                                    human: "Er zijn meerdere TXT records ingesteld voor "+record.name+", kijk na of je er geen moet verwijderen of per ongeluk meerder hebt aangemaakt"
                                }))
                            } else {
                                if (records[0].join("").trim() === record.value.trim()) {
                                    record.status = DNSRecordStatus.Valid
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
                    console.error(e)
                    record.status = DNSRecordStatus.Pending
                    allValid = false
                }
            }
        }

        if (allValid) {
            if (organization.privateMeta.pendingMailDomain !== null) {
                organization.privateMeta.mailDomain = organization.privateMeta.pendingMailDomain
                organization.privateMeta.pendingMailDomain = null;
                
                const sesv2 = new SES();

                // Check if mail identitiy already exists..
                let exists = false
                try {
                    const existing = await sesv2.getEmailIdentity({
                        EmailIdentity: organization.privateMeta.mailDomain
                    }).promise()
                    exists = true
                } catch (e) {
                    console.error(e)
                    // todo
                }
                
                if (!exists) {
                    console.log("Creating email identity")

                    const result = await sesv2.createEmailIdentity({
                        EmailIdentity: organization.privateMeta.mailDomain,
                        DkimSigningAttributes: {
                            DomainSigningPrivateKey: organization.serverMeta.privateDKIMKey!,
                            DomainSigningSelector: "stamhoofd"
                        },
                        Tags: [
                            {
                                "Key": "OrganizationId",
                                "Value": organization.id
                            },
                            {
                                "Key": "CreatedBy",
                                "Value": user.id
                            },
                            {
                                "Key": "Environment",
                                "Value": process.env.NODE_ENV ?? "Unknown"
                            }
                        ]

                    }).promise()

                    // todo: check result
                    if (result.VerifiedForSendingStatus !== true) {
                        console.error("Not validated :/")
                    }
                }
                
            }

            // yay! Do not Save until after doing AWS changes
            await organization.save()
        } else {
            await organization.save()
        }
    }
}
