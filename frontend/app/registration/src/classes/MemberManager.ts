

import { ArrayDecoder, Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { SessionContext, Storage } from '@stamhoofd/networking';
import { Document, IDRegisterCheckout, MembersBlob, Platform, PlatformFamily, Version } from '@stamhoofd/structures';
import { reactive } from 'vue';
import { watch } from 'vue';

/**
 * Controls the fetching and decrypting of members
 */
export class MemberManager {
    /// Currently saved members
    $context: SessionContext;
    family: PlatformFamily;

    _unwatch: any;

    constructor($context: SessionContext, platform: Platform) {
        this.$context = $context
        this.family = reactive(
            new PlatformFamily({
                contextOrganization: $context.organization,
                platform,
            }) as any
        ) as PlatformFamily;
        this.watchCheckout()
    }

    watchCheckout() {
        if (this._unwatch) {
            this._unwatch()
        }

        this._unwatch = watch(() => this.family.checkout, () => {
            this.saveCheckout().catch(console.error)
        }, { deep: true });
    }

    async loadCheckout() {
        console.log('Loading checkout')

        try {
            const storedData = await Storage.keyValue.getItem("register_checkout_" + (this.$context.organization?.id ?? "platform"));
            if (storedData) {
                const json = JSON.parse(storedData);
                const data = new ObjectData(json, {version: 0})
                const decoder = new VersionBoxDecoder(IDRegisterCheckout as Decoder<IDRegisterCheckout>)
                const idCheckout = data.decode(decoder).data
                const checkout = idCheckout.hydrate({family: this.family})
                this.family.checkout = checkout
                this.watchCheckout()
            }
        } catch (e) {
            console.error(e)
        }
    }

    async saveCheckout() {
        console.log('Saving checkout')
        try {
            const versionBox = new VersionBox(this.family.checkout.convert())
            const encoded = JSON.stringify(versionBox.encode({version: Version}))
            await Storage.keyValue.setItem("register_checkout_" + (this.$context.organization?.id ?? "platform"), encoded);
        } catch (e) {
            console.error(e)
        }
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
