import { AutoEncoderPatchType, Decoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, GlobalEventBus, Toast, Validator } from "@stamhoofd/components";
import { PrivateWebshop, Version, WebshopPreview, WebshopTicketType } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";
import { WebshopManager } from '../WebshopManager';

@Component
export default class EditWebshopMixin extends Mixins(NavigationMixin) {
    @Prop({ required: false })
    webshopManager?: WebshopManager

    @Prop({ required: false })
    initialWebshop?: PrivateWebshop

    @Prop({ required: false })
    savedHandler?: (webshop: PrivateWebshop) => Promise<void>

    originalWebshop: PrivateWebshop = this.webshopManager?.webshop ?? this.initialWebshop ?? PrivateWebshop.create({})

    get isNew() {
        return this.webshopManager === undefined
    }

    webshopPatch = PrivateWebshop.patch({})
    saving = false

    errorBox: ErrorBox | null = null
    validator = new Validator()

    get webshop() {
        return this.originalWebshop.patch(this.webshopPatch)
    }

    addPatch(patch: AutoEncoderPatchType<PrivateWebshop>) {
        this.webshopPatch = this.webshopPatch.patch(patch)
    }

    get hasChanges() {
        return patchContainsChanges(this.webshopPatch, this.originalWebshop, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    validate(): Promise<void> | void {
        // override if needed
    }

    afterSave(): Promise<void> | void {
        // override if needed
    }

    shouldDismiss(): Promise<boolean> | boolean {
        return true
    }

    async save() {
        if (this.saving) {
            return
        }

        this.saving = true

        try {
            if (!await this.validator.validate()) {
                this.saving = false
                return
            }

            await this.validate()

            if (this.isNew) {
                const response = await this.$context.authenticatedServer.request({
                    method: "POST",
                    path: "/webshop",
                    body: this.webshop,
                    decoder: PrivateWebshop as Decoder<PrivateWebshop>,
                    shouldRetry: false
                })

                await this.afterSave()

                if (this.savedHandler) {
                    await this.savedHandler(response.data)
                }

                const preview = WebshopPreview.create(response.data)
                this.$organizationManager.organization.webshops.push(preview)

                // Save updated organization to cache
                this.$organizationManager.save().catch(console.error)

                // Save to database
                const manager = new WebshopManager(this.$context, preview)
                await manager.storeWebshop(response.data)
                manager.close()

                // Send system wide notification that we might need an update in data
                await GlobalEventBus.sendEvent("new-webshop", response.data)
                new Toast(
                    response.data.meta.ticketType === WebshopTicketType.Tickets
                        ? "Jouw nieuwe ticketverkoop is aangemaakt. Je kan nu tickets of vouchers toevoegen die je wilt verkopen."
                        : "Jouw nieuwe webshop is aangemaakt. Je kan nu de producten toevoegen die je wilt verkopen en andere instellingen wijzigen."
                    , "success green").show()
            } else {
                await this.webshopManager!.patchWebshop(this.webshopPatch)

                await this.afterSave()

                if (this.savedHandler && this.webshopManager!.webshop) {
                    await this.savedHandler(this.webshopManager!.webshop)
                }

                new Toast("Jouw wijzigingen zijn opgeslagen", "success green").show()

                // Clear the patch
                this.webshopPatch = PrivateWebshop.patch({})
            }

            const dis = await this.shouldDismiss()
            if (dis) {
                this.dismiss({ force: true })
            }
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

}