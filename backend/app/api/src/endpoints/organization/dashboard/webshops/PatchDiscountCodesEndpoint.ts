import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, patchObject, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Webshop, WebshopDiscountCode } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { DiscountCode, PermissionLevel } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';

type Params = { id: string };
type Query = undefined;
type Body = PatchableArrayAutoEncoder<DiscountCode>;
type ResponseBody = DiscountCode[];

export class PatchWebshopDiscountCodesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(DiscountCode as Decoder<DiscountCode>, DiscountCode.patchType() as Decoder<AutoEncoderPatchType<DiscountCode>>, StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshop/@id/discount-codes', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        const webshop = await Webshop.getByID(request.params.id);
        if (!webshop || !await Context.auth.canAccessWebshop(webshop, PermissionLevel.Full)) {
            throw Context.auth.notFoundOrNoAccess();
        }

        const discountCodes: WebshopDiscountCode[] = [];

        // Updating discoutn codes should happen in the stock queue (because they are also edited when placing orders)
        await QueueHandler.schedule('webshop-stock/' + request.params.id, async () => {
            // TODO: handle order creation here
            for (const put of request.body.getPuts()) {
                const struct = put.put;
                const model = new WebshopDiscountCode();
                model.code = struct.code;
                model.description = struct.description;
                model.webshopId = webshop.id;
                model.organizationId = webshop.organizationId;
                model.discounts = struct.discounts;
                model.maximumUsage = struct.maximumUsage;

                try {
                    await model.save();
                }
                catch (e) {
                    // Duplicate key probably
                    if (e.code && e.code == 'ER_DUP_ENTRY') {
                        throw new SimpleError({
                            code: 'used_code',
                            message: 'Discount code already in use',
                            human: $t(`d8cf1267-28dd-4d70-9f5f-1ed800729f6d`) + ' ' + struct.code + $t(`9145b0bf-8539-4ddc-8867-859f8716f026`),
                        });
                    }
                    throw e;
                }

                discountCodes.push(model);
            }

            for (const patch of request.body.getPatches()) {
                const model = await WebshopDiscountCode.getByID(patch.id);
                if (!model || model.webshopId !== webshop.id) {
                    throw new SimpleError({
                        code: 'not_found',
                        message: 'Discount code with id ' + patch.id + ' does not exist',
                    });
                }

                model.code = patchObject(model.code, patch.code);
                model.description = patchObject(model.description, patch.description);
                model.discounts = patchObject(model.discounts, patch.discounts);
                model.maximumUsage = patchObject(model.maximumUsage, patch.maximumUsage);

                try {
                    await model.save();
                }
                catch (e) {
                    // Duplicate key probably
                    if (e.code && e.code == 'ER_DUP_ENTRY') {
                        throw new SimpleError({
                            code: 'used_code',
                            message: 'Discount code already in use',
                            human: $t(`d8cf1267-28dd-4d70-9f5f-1ed800729f6d`) + ' ' + model.code + $t(`9145b0bf-8539-4ddc-8867-859f8716f026`),
                        });
                    }
                    throw e;
                }

                discountCodes.push(model);
            }

            for (const id of request.body.getDeletes()) {
                const model = await WebshopDiscountCode.getByID(id);
                if (!model || model.webshopId !== webshop.id) {
                    throw new SimpleError({
                        code: 'not_found',
                        message: 'Discount code with id ' + id + ' does not exist',
                    });
                }

                await model.delete();
            }
        });

        return new Response(
            discountCodes.map(d => d.getStructure()),
        );
    }
}
