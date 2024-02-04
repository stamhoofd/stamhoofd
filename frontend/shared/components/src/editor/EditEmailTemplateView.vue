<template>
    <EditorView ref="editorView" class="mail-view" title="E-mail template" save-text="Opslaan" :smart-variables="smartVariables" :smart-buttons="smartButtons" :style="{'--editor-primary-color': primaryColor, '--editor-primary-color-contrast': primaryColorContrast}" @save="save">
        <h1 v-if="isNew" class="style-navigation-title">
            Nieuwe template
        </h1>
        <h1 v-else class="style-navigation-title">
            Wijzig template
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <!-- Buttons -->
        <template slot="buttons">
            <hr v-if="!$isMobile">
            <button v-if="!$isMobile" v-tooltip="'Voorbeeld tonen'" class="button icon eye" type="button" @click="openPreview" />
        </template>

        <!-- List -->
        <template slot="list">
            <STListItem class="no-padding" element-name="label">
                <div class="list-input-box">
                    <span>Onderwerp:</span>
                    <input id="mail-subject" v-model="subject" class="list-input" type="text" placeholder="Typ hier het onderwerp van je e-mail">
                </div>
            </STListItem>
        </template>
    </EditorView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, Dropdown, EditorSmartButton, EditorSmartVariable, EditorView, EmailStyler, ErrorBox, STErrorsDefault, STInputBox, STList, STListItem, TooltipDirective } from "@stamhoofd/components";
import { Replacement } from '@stamhoofd/structures';
import { EmailTemplate, Group, Version, WebshopPreview } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        EditorView,
        STInputBox,
        STList,
        STListItem,
        Checkbox,
        Dropdown,
        STErrorsDefault,
    },
    directives: {
        Tooltip: TooltipDirective
    }
})
export default class EditEmailTemplateView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        template: EmailTemplate

    @Prop({ required: true })
        isNew: boolean

    @Prop({ required: false, default: () => [] })
        smartVariables: EditorSmartVariable[]

    @Prop({ required: false, default: () => [] })
        smartButtons: EditorSmartButton[]

    @Prop({ required: false, default: () => [] })
        defaultReplacements: Replacement[]

    // Used to determine default from address
    @Prop({ default: null})
        webshop!: WebshopPreview | null

    @Prop({ required: true })
        saveHandler: (patch: AutoEncoderPatchType<EmailTemplate>) => Promise<void>;
    
    // Used to determine default from address
    @Prop({ default: null })
        group!: Group | null

    templatePatch = EmailTemplate.patch({})
    
    saving = false

    errorBox: ErrorBox | null = null
    
    get patchedTemplate() {
        return this.template.patch(this.templatePatch)
    }

    addPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<EmailTemplate>>) {
        this.templatePatch = this.templatePatch.patch(EmailTemplate.patch(patch))
    }

    get subject() {
        return this.patchedTemplate.subject
    }

    set subject(subject: string) {
        this.addPatch({ subject })
    }

    get editor() {
        return (this.$refs.editorView as EditorView).editor
    }

    mounted() {
        this.editor.commands.setContent(this.patchedTemplate.json)
    }

    get primaryColor() {
        return this.defaultReplacements.find(r => r.token === 'primaryColor')?.value ?? "#0053ff"
    }

    get primaryColorContrast() {
        return this.defaultReplacements.find(r => r.token === 'primaryColorContrast')?.value ?? "#fff"
    }

    async getHTML() {
        const editor = this.editor
        if (!editor) {
            // When editor is not yet loaded: slow internet -> need to know html on dismiss confirmation
            return {
                text: "",
                html: "",
                json: {}
            }
        }

        const base: string = editor.getHTML();
        return {
            ...await EmailStyler.format(base, this.subject),
            json: this.editor.getJSON()
        }
    }

    existingWindow: Window | null

    async openPreview() {
        if (this.existingWindow) {
            // Disable reuse in some browsers
            this.existingWindow.close()
        }
        const newWindow = window.open("", "Voorbeeld"+Math.floor(Math.random()*9999999), "width=650,height=800,menubar=no,toolbar=no,location=no,resizable=yes");
        if (!newWindow) {
            return
        }
        var sY = screenY;
        if (sY < 0) {
            sY = 0;
        }
        var totalScreenWidth = (screenX + window.outerWidth + sY);
        if (totalScreenWidth > screen.width) {
            totalScreenWidth = totalScreenWidth / 2;
        } else {
            totalScreenWidth = 0;
        }
        let { html } = await this.getHTML()
        let subject = this.subject

        // Replacements
        for (const variable of this.smartVariables) {
            if (html) {
                html = html.replaceAll("{{"+variable.id+"}}", variable.html ?? Formatter.escapeHtml(variable.example))
            }
            subject = subject.replaceAll("{{"+variable.id+"}}", variable.example)
        }

        // Replacements
        for (const variable of this.smartButtons) {
            html = html.replaceAll("{{"+variable.id+"}}", '#')
        }

        const extra = this.defaultReplacements ?? []
        for (const replacement of extra) {
            if (html) {
                html = html.replaceAll("{{"+replacement.token+"}}", replacement.html ?? Formatter.escapeHtml(replacement.value))
            }
            subject = subject.replaceAll("{{"+replacement.token+"}}", replacement.value)
        }

        html = html.replace("<body>", "<body><p><strong>Onderwerp:</strong> "+subject+"</p><hr>")

        newWindow.document.write(html);

        this.existingWindow = newWindow
    }

    async save() {
        if (this.saving) {
            return;
        }

        if (this.subject.length < 2) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "Vul zeker een onderwerp in, anders is de kans groot dat jouw e-mail als spam wordt gezien",
                field: "subject"
            }))
            return;
        }

        try {
            const {text, html, json} = await this.getHTML()

            if (!text || text.length < 20) {
                this.errorBox = new ErrorBox(new SimpleError({
                    code: "",
                    message: "Vul een voldoende groot bericht in, anders is de kans groot dat jouw e-mail als spam wordt gezien",
                    field: "message"
                }))
                return;
            }

            this.addPatch({
                text,
                html,
                json
            })

            this.errorBox = null
            this.saving = true;

            await this.saveHandler(this.templatePatch)
            
            this.dismiss({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.saving = false
    }

    async shouldNavigateAway() {
        if ((await this.getHTML()).text == this.patchedTemplate.text && !patchContainsChanges(this.templatePatch, this.template, { version: Version })) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan", "Niet opslaan")
    }
}
</script>

<style lang="scss">

.mail-view {
    .mail-hr {
        margin: 0;
        margin-right: calc(-1 * var(--st-horizontal-padding, 40px));
    }

    #message-title {
        padding-bottom: 0;
    }

    
    .file-list-item {
        .middle {
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;

            > h3 {
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }
        }
    }
    
}
</style>
