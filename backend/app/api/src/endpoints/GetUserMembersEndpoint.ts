import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Member } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { EncryptedMemberWithRegistrations, KeychainedResponse } from "@stamhoofd/structures";
type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = KeychainedResponse<EncryptedMemberWithRegistrations[]>;

/**
 * Get the members of the user
 */
export class GetUserMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/members", {});

        if (params) {
            if (request.getVersion() < 71) {
                throw new SimpleError({
                    code: "not_supported",
                    message: "This version is no longer supported",
                    human: "Oops! Er is een nieuwe versie beschikbaar van de inschrijvingswebsite. Door grote wijzigingen moet je die verplicht gebruiken: herlaad de website en verwijder indien nodig de cache van jouw browser."
                })
            }
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (request.request.getVersion() < 71) {
            throw new SimpleError({
                code: "not_supported",
                message: "This version is no longer supported",
                human: "Oops! Er is een nieuwe versie beschikbaar van de inschrijvingswebsite. Door grote wijzigingen moet je die verplicht gebruiken: herlaad de website en verwijder indien nodig de cache van jouw browser."
            })
        }

        const token = await Token.authenticate(request);
        const user = token.user

        const members = await Member.getMembersWithRegistrationForUser(user)
        
        return new Response(new KeychainedResponse({
            data: members.map(m => m.getStructureWithRegistrations()),
            keychainItems: []
        }));
    }
}
