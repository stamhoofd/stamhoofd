import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Document, Member, mergeTwoMembers, RateLimiter } from '@stamhoofd/models';
import { MemberDetails, MembersBlob, MemberWithRegistrationsBlob } from "@stamhoofd/structures";

import { Email } from '@stamhoofd/email';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { MemberUserSyncer } from '../../../helpers/MemberUserSyncer';
import { PatchOrganizationMembersEndpoint } from '../../global/members/PatchOrganizationMembersEndpoint';
type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>
type ResponseBody = MembersBlob

export const securityCodeLimiter = new RateLimiter({
    limits: [
        {   
            // Max 10 a day
            limit: 10,
            duration: 24 * 60 * 1000 * 60
        }
    ]
});


/**
 * Allow to add, patch and delete multiple members simultaneously, which is needed in order to sync relational data that is saved encrypted in multiple members (e.g. parents)
 */
export class PatchUserMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(MemberWithRegistrationsBlob as Decoder<MemberWithRegistrationsBlob>, MemberWithRegistrationsBlob.patchType() as Decoder<AutoEncoderPatchType<MemberWithRegistrationsBlob>>, StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/members", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setUserOrganizationScope();
        const {user} = await Context.authenticate()

        // Process changes
        const addedMembers: Member[] = []
        for (const put of request.body.getPuts()) {
            const struct = put.put

            const member = new Member()
            member.id = struct.id
            member.organizationId = organization?.id ?? null

            struct.details.cleanData()
            member.details = struct.details

            this.throwIfInvalidDetails(member.details);

            const duplicate = await this.checkDuplicate(member, struct.details.securityCode)
            if (duplicate) {
                addedMembers.push(duplicate)
                continue
            }

            await member.save()
            addedMembers.push(member)
        }


        // Modify members
        let members = await Member.getMembersWithRegistrationForUser(user)

        for (let struct of request.body.getPatches()) {
            const member = members.find((m) => m.id == struct.id)
            if (!member) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "This member does not exist or you don't have permissions to modify this member",
                    human: "Je probeert een lid aan te passen die niet (meer) bestaat. Er ging ergens iets mis."
                })
            }
            const securityCode = struct.details?.securityCode // will get cleared after the filter
            struct = await Context.auth.filterMemberPatch(member, struct)

            if (struct.details) {
                if (struct.details.isPut()) {
                    throw new SimpleError({
                        code: "not_allowed",
                        message: "Cannot override details",
                        human: "Er ging iets mis bij het aanpassen van de gegevens van dit lid. Probeer het later opnieuw en neem contact op als het probleem zich blijft voordoen.",
                        field: "details"
                    })
                }

                member.details.patchOrPut(struct.details)
                member.details.cleanData();
                this.throwIfInvalidDetails(member.details);
            }

            if (!member.details) {
                throw new SimpleError({
                    code: "invalid_data",
                    message: "No details provided",
                    human: "Opgelet! Je gebruikt een oudere versie van de inschrijvingspagina die niet langer wordt ondersteund. Herlaad de website grondig en wis je browser cache.",
                    field: "details"
                })
            }

            /*const duplicate = await this.checkDuplicate(member, securityCode)
            if (duplicate) {
                // Remove the member from the list
                members.splice(members.findIndex(m => m.id === member.id), 1)

                // Add new
                addedMembers.push(duplicate)
                continue
            }*/

            await member.save();
            await MemberUserSyncer.onChangeMember(member)

            // Update documents
            await Document.updateForMember(member.id)
        }

        // Modify members
        if (addedMembers.length > 0) {
            // Give access to created members
            await Member.users.reverse("members").link(user, addedMembers)
        }

        await PatchOrganizationMembersEndpoint.deleteMembers(request.body.getDeletes())
        
        members = await Member.getMembersWithRegistrationForUser(user)

        for (const member of addedMembers) {
            const updatedMember = members.find(m => m.id === member.id);
            if (updatedMember) {
                // Make sure we also give access to other parents
                await MemberUserSyncer.onChangeMember(updatedMember)

                if (!updatedMember.users.find(u => u.id === user.id)) {
                    // Also link the user to the member if the email address is missing in the details
                    await MemberUserSyncer.linkUser(user.email, updatedMember, true)
                }

                await Document.updateForMember(updatedMember.id)
            }
        }


        return new Response(
            await AuthenticatedStructures.membersBlob(members)
        );
    }

    async checkDuplicate(member: Member, securityCode: string|null|undefined) {
        // Check for duplicates and prevent creating a duplicate member by a user
        const duplicate = await PatchOrganizationMembersEndpoint.checkDuplicate(member);
        if (duplicate) {
            if (await duplicate.isSafeToMergeDuplicateWithoutSecurityCode()) {
                console.log("Merging duplicate without security code: allowed for " + duplicate.id)
            } else if (securityCode) {
                try {
                    securityCodeLimiter.track(member.details.name, 1);
                } catch (e) {
                    Email.sendWebmaster({
                        subject: "[Limiet] Limiet bereikt voor aantal beveiligingscodes",
                        text: "Beste, \nDe limiet werd bereikt voor het aantal beveiligingscodes per dag. \nNaam lid: "+member.details.name+" (ID: "+duplicate.id+")" + "\n\n" + e.message + "\n\nStamhoofd"
                    })
    
                    throw new SimpleError({
                        code: "too_many_tries",
                        message: "Too many securityCodes limited",
                        human: "Oeps! Om spam te voorkomen limiteren we het aantal beveiligingscodes die je kan proberen. Probeer morgen opnieuw.",
                        field: "details.securityCode"
                    })
                }

                // Entered the security code, so we can link the user to the member
                if (STAMHOOFD.environment !== 'development') {
                    if (!duplicate.details.securityCode || securityCode !== duplicate.details.securityCode) {
                        throw new SimpleError({
                            code: "invalid_field",
                            field: 'details.securityCode',
                            message: "Invalid security code",
                            human: Context.i18n.$t('49753d6a-7ca4-4145-8024-0be05a9ab063'),
                            statusCode: 400
                        })
                    }
                }

                console.log("Merging duplicate: security code is correct - for " + duplicate.id)
            } else {
                throw new SimpleError({
                    code: "known_member_missing_rights",
                    message: "Creating known member without sufficient access rights",
                    human: `${member.details.firstName} is al gekend in ons systeem, maar jouw e-mailadres niet. Om toegang te krijgen heb je de beveiligingscode nodig.`,
                    statusCode: 400
                })
            }

            // Merge data
            // NOTE: We use mergeTwoMembers instead of mergeMultipleMembers, because we should never safe 'member' , because that one does not exist in the database
            await mergeTwoMembers(duplicate, member)
            return duplicate
        }
    }

    private throwIfInvalidDetails(details: MemberDetails) {
        if(details.firstName.length < 2) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Voornaam is te kort",
                field: "firstName"
            });
        }

        if(details.lastName.length < 2) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Achternaam is te kort",
                field: "lastName"
            });
        }
    }
}
