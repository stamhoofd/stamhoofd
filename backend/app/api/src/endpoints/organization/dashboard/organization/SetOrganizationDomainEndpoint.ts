import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { DNSRecord, DNSRecordType, Organization as OrganizationStruct,OrganizationDomains } from "@stamhoofd/structures";
import NodeRSA from 'node-rsa';

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures';
import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
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
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        if (!await Context.auth.canManageOrganizationDomain(organization.id)) {
            throw Context.auth.error()
        }

        const errors = new SimpleErrors()

        // check if changed
        if (
            (organization.privateMeta.pendingRegisterDomain ?? organization.registerDomain) !== request.body.registerDomain  // changed register domain
            || 
            (organization.privateMeta.pendingMailDomain ?? organization.privateMeta.mailDomain) !== request.body.mailDomain  // changed pending domain
        ) {
            console.log("Domains changed")

            // Validate domains
            // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
            if (request.body.registerDomain !== null && !request.body.registerDomain.match(/^([a-zA-Z0-9-]+\.)?[a-zA-Z0-9-]+\.[a-zA-Z]+$/)) {
                throw new SimpleError({
                    code: "invalid_domain",
                    message: "registerDomain is invalid",
                    human: "De subdomeinnaam voor jouw registratiepagina is ongeldig",
                    field: "registerDomain"
                })
            }
            
            // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
            if (request.body.mailDomain !== null && !request.body.mailDomain.match(/^([a-zA-Z0-9-]+\.)?[a-zA-Z0-9-]+\.[a-zA-Z]+$/)) {
                throw new SimpleError({
                    code: "invalid_domain",
                    message: "mailDomain is invalid",
                    human: "De domeinnaam voor e-mails is ongeldig",
                    field: "mailDomain"
                })
            }

            const oldMailDomain = organization.privateMeta.mailDomain

            organization.privateMeta.pendingRegisterDomain = request.body.registerDomain?.toLowerCase() ?? null
            organization.privateMeta.pendingMailDomain = request.body.mailDomain?.toLowerCase() ?? null

            // We don't keep the current register domain because we have no way to validate the old DNS-records
            if (organization.privateMeta.pendingRegisterDomain === null || organization.registerDomain !== organization.privateMeta.pendingRegisterDomain) {
                organization.registerDomain = null
            }

            // We don't keep the current mail domain because we have no way to validate the old DNS-records
            if (organization.privateMeta.pendingMailDomain === null || organization.privateMeta.mailDomain !== organization.privateMeta.pendingMailDomain) {
                organization.privateMeta.mailDomain = null
            }

            // Always temporary disable mail domain until validated
            organization.privateMeta.mailDomainActive = false

            // Reset notification counters
            organization.serverMeta.DNSRecordWarningCount = 0
            organization.serverMeta.firstInvalidDNSRecords = undefined
            organization.serverMeta.didSendDomainSetupMail = false

            // Generate new DNS-records
            organization.privateMeta.dnsRecords = []

            if (organization.privateMeta.pendingMailDomain !== null) {
                const defaultFromDomain = "stamhoofd." + organization.privateMeta.pendingMailDomain;
                if (organization.privateMeta.pendingRegisterDomain === null || !organization.privateMeta.pendingRegisterDomain.endsWith('.' + organization.privateMeta.pendingMailDomain)) {
                    // We set a custom domainname for webshops already
                    // This is not used at this moment
                    organization.privateMeta.mailFromDomain = defaultFromDomain;
                } else {
                    // CNAME domain: for SPF + MX + A record
                    organization.privateMeta.mailFromDomain = organization.privateMeta.pendingRegisterDomain;
                }

                if (organization.privateMeta.mailFromDomain !== organization.privateMeta.pendingRegisterDomain) {
                        
                    organization.privateMeta.dnsRecords.push(DNSRecord.create({
                            type: DNSRecordType.CNAME,
                            name: organization.privateMeta.mailFromDomain + ".",
                            // Use shops for mail domain, to allow reuse
                            value: STAMHOOFD.domains.webshopCname + "."
                        }))

                        if (STAMHOOFD.domains.registration && organization.privateMeta.pendingRegisterDomain) {
                            organization.privateMeta.dnsRecords.push(DNSRecord.create({
                                type: DNSRecordType.CNAME,
                                name: organization.privateMeta.pendingRegisterDomain+".",
                                // Use registration domain
                                value: STAMHOOFD.domains.registrationCname + "."
                            }))
                        }
                } else {
                    organization.privateMeta.dnsRecords.push(DNSRecord.create({
                        type: DNSRecordType.CNAME,
                        name: organization.privateMeta.mailFromDomain+".",
                        // Use registration domain
                        value: STAMHOOFD.domains.registrationCname + "."
                    }))
                }
            }

            if (request.body.mailDomain !== null) {

                let priv: string
                let pub: string

                if (!organization.serverMeta.privateDKIMKey || !organization.serverMeta.publicDKIMKey ) {
                    const key = new NodeRSA({ b: request.body.useDkim1024bit ? 1024 : 2048 });
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

                // DKIM records
                organization.privateMeta.dnsRecords.push(DNSRecord.create({
                    type: DNSRecordType.TXT,
                    name: "stamhoofd._domainkey." + request.body.mailDomain + ".",
                    value: "v=DKIM1; k=rsa; p=" + pub + ""
                }))
            } else {
                if (oldMailDomain) {
                    organization.deleteAWSMailIdenitity(oldMailDomain).catch(console.error)
                }

                if (organization.serverMeta.privateDKIMKey && organization.serverMeta.publicDKIMKey ) {
                    // Allow creation of new keys for new domains
                    console.log("Backup DKIM keys for "+organization.id)
                    console.log("Private: "+organization.serverMeta.privateDKIMKey)
                    console.log("Public: "+organization.serverMeta.publicDKIMKey)

                    // Delete keys if mail domain is deleted -> to allow new keys
                    organization.serverMeta.privateDKIMKey = undefined
                    organization.serverMeta.publicDKIMKey = undefined
                }
            }

            await organization.save()

        } else {
            // Validate DNS-records if not empty
            console.log("Validating domains")
            await organization.updateDNSRecords()
        }

        console.log("Done.")
        
        errors.throwIfNotEmpty()
        return new Response(await AuthenticatedStructures.organization(organization));
    }

    
}
