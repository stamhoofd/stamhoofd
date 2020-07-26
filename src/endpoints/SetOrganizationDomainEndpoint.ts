import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { DNSRecord, DNSRecordType, Organization as OrganizationStruct,OrganizationDomains } from "@stamhoofd/structures";
import NodeRSA from 'node-rsa';

import { Token } from '../models/Token';

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
            await organization.updateDNSRecords()
        }

        console.log("Done.")
        
        errors.throwIfNotEmpty()
        return new Response(await user.getOrganizatonStructure(organization));
    }

    
}
