import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { calculateVATPercentage, STBillingStatus, STInvoice as STInvoiceStruct, STInvoiceMeta, STPackage as STPackageStruct } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";

import { STInvoice } from "../../models/STInvoice";
import { STPackage } from "../../models/STPackage";
import { STPendingInvoice } from '../../models/STPendingInvoice';
import { Token } from '../../models/Token';
type Params = {};
type Query = undefined;
type ResponseBody = STBillingStatus;
type Body = undefined;

export class GetBillingStatusEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/billing/status", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        // If the user has permission, we'll also search if he has access to the organization's key
        if (user.permissions === null || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You don't have permissions for this endpoint",
                statusCode: 403
            })
        }

        // Get all packages
        const packages = await STPackage.getForOrganization(user.organizationId)

        // GEt all invoices
        const invoices = await STInvoice.where({ organizationId: user.organizationId, number: { sign: "!=", value: null }})

        // Get the pending invoice if it exists
        const pendingInvoice = await STPendingInvoice.getForOrganization(user.organizationId)

        // Generate temporary pending invoice items for the current state without adding them IRL
        const notYetCreatedItems = await STPendingInvoice.createItems(user.organizationId, pendingInvoice)
        const pendingInvoiceStruct = pendingInvoice ? STInvoiceStruct.create(pendingInvoice) : (notYetCreatedItems.length > 0 ? STInvoiceStruct.create({
            meta: STInvoiceMeta.create({
                companyName: user.organization.name,
                companyAddress: user.organization.address,
                companyVATNumber: user.organization.privateMeta.VATNumber,
                VATPercentage: calculateVATPercentage(user.organization.address, user.organization.privateMeta.VATNumber)
            })
        }) : null)
        
        if (notYetCreatedItems.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            pendingInvoiceStruct!.meta.items.push(...notYetCreatedItems)
        }

        const invoiceStructures: STInvoiceStruct[] = []
        for (const invoice of invoices) {
            invoiceStructures.push(await invoice.getStructure())
        }

        return new Response(STBillingStatus.create({
            packages: packages.map(pack => STPackageStruct.create(pack)),
            invoices: invoiceStructures,
            pendingInvoice: pendingInvoiceStruct
        }));
    }
}
