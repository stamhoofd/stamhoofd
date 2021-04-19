import { ArrayDecoder,Decoder,PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { KeychainedResponse, KeychainItem as KeychainItemStruct, Organization as OrganizationStruct  } from "@stamhoofd/structures";

import { KeychainItem } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
type Params = {};
type Query = undefined;
type Body = KeychainItemStruct[]
type ResponseBody = undefined;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PostKeychainEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new ArrayDecoder(KeychainItemStruct as Decoder<KeychainItemStruct>)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/keychain", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        // Patch or create keychain items
        for (const item of request.body) {
            const models = await KeychainItem.where({ userId: user.id, publicKey: item.publicKey }, { limit: 1 })
            let model: KeychainItem
            if (models.length == 0) {
                model = new KeychainItem()
                model.publicKey = item.publicKey
                model.userId= user.id
            } else {
                model = models[0]
            }

            model.encryptedPrivateKey = item.encryptedPrivateKey

            await model.save()
        }

        
        return new Response(undefined);
    }
}
