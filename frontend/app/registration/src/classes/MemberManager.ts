

import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { SessionContext } from '@stamhoofd/networking';
import { Document, Group, MembersBlob, PlatformMember, RegisterCheckout, RegisterContext, RegisterItem } from '@stamhoofd/structures';

/**
 * Controls the fetching and decrypting of members
 */
export class MemberManager {
    /// Currently saved members
    $context: SessionContext;
    members: PlatformMember[] = []
    checkout: RegisterCheckout = new RegisterCheckout()

    constructor($context: SessionContext) {
        this.$context = $context
    }

    get registerContext(): RegisterContext {
        return {
            members: this.members,
            checkout: this.checkout
        }
    }

    defaultItem(member: PlatformMember, group: Group): RegisterItem {
        return RegisterItem.defaultFor(member, group, this.registerContext)
    }

    canRegister(member: PlatformMember, group: Group) {
        return this.canRegisterError(member, group) === null;
    }

    canRegisterError(member: PlatformMember, group: Group): string|null {
        const item = this.defaultItem(member, group)
        try {
            item.validate(this.registerContext)
        } catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                return e.getHuman();
            }
            throw e;
        }
        return null;
    }

    get isAcceptingNewMembers() {
        return STAMHOOFD.userMode === 'platform' ? true : (this.$context.organization?.isAcceptingNewMembers(this.$context.hasPermissions()) ?? true);
    }

    async loadMembers() {
        const response = await this.$context.authenticatedServer.request({
            method: "GET",
            path: "/members",
            decoder: MembersBlob as Decoder<MembersBlob>
        })
        const blob = response.data
        const members: PlatformMember[] = []
        for (const member of blob.members) {
            members.push(
                PlatformMember.createFrom({
                    member,
                    blob,
                    contextOrganization: this.$context.organization
                })
            )
        }
        this.members = members;
    }

    async loadDocuments() {
        const response = await this.$context.authenticatedServer.request({
            method: "GET",
            path: "/documents",
            decoder: new ArrayDecoder(Document as Decoder<Document>)
        })
        //this.setDocuments(response.data)
    }

   
}
