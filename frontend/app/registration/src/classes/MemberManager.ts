

import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { SessionContext } from '@stamhoofd/networking';
import { Document, MemberWithRegistrationsBlob } from '@stamhoofd/structures';

/**
 * Controls the fetching and decrypting of members
 */
export class MemberManager {
    /// Currently saved members
    $context: SessionContext

    constructor($context: SessionContext) {
        this.$context = $context
    }


    async loadMembers() {
        const response = await this.$context.authenticatedServer.request({
            method: "GET",
            path: "/members",
            decoder: new ArrayDecoder(MemberWithRegistrationsBlob as Decoder<MemberWithRegistrationsBlob>)
        })
        //this.setMembers(response.data)
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
