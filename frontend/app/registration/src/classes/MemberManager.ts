

import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { SessionContext } from '@stamhoofd/networking';
import { Document, MembersBlob, Platform, PlatformFamily } from '@stamhoofd/structures';
import { reactive } from 'vue';

/**
 * Controls the fetching and decrypting of members
 */
export class MemberManager {
    /// Currently saved members
    $context: SessionContext;
    family: PlatformFamily;

    constructor($context: SessionContext) {
        this.$context = $context
        this.family = reactive(
            new PlatformFamily({
                contextOrganization: $context.organization,
                platform: Platform.shared,
            })
        ) as PlatformFamily;
    }

    get isAcceptingNewMembers() {
        return STAMHOOFD.userMode === 'platform' ? true : (this.$context.organization?.isAcceptingNewMembers(this.$context.hasPermissions()) ?? true);
    }

    async loadMembers() {
        const response = await this.$context.authenticatedServer.request({
            method: "GET",
            path: "/user/members",
            decoder: MembersBlob as Decoder<MembersBlob>
        })
        const blob = response.data
        this.family.insertFromBlob(blob)
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
