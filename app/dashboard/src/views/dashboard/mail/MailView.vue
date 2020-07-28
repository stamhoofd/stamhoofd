<template>
    <div class="st-view mail-view">
        <STNavigationBar title="Mail versturen">
            <template #right>
                <button class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">Mail versturen</span>
        </STNavigationTitle>

        <main>
            <p class="warning-box" v-if="emails.length == 0">Stel eerst jouw e-mailadressen in: <button class="button text" @click="manageEmails">
                <span class="icon settings" />
                <span>Wijzigen</span>
            </button></p>


            <div class="split-inputs">
                <STInputBox title="Onderwerp">
                    <input id="mail-subject" class="input" type="text" placeholder="Typ hier het onderwerp van je e-mail" v-model="subject">
                </STInputBox>

                <STInputBox title="Versturen vanaf" v-if="emails.length > 0">
                    <button slot="right" class="button text" @click="manageEmails">
                        <span class="icon settings" />
                        <span>Wijzigen</span>
                    </button>
                    <select class="input" v-model="emailId">
                        <option v-for="email in emails" :key="email.id" :value="email.id">{{ email.name ? email.name+" <"+email.email+">" : email.email }}</option>
                    </select>
                </STInputBox>
            </div>

            <STInputBox title="Bericht" id="message-title" />
            <MailEditor ref="editor"/>
        </main>

        <STToolbar>
            <template #left>
                {{
                    recipients.length
                        ? recipients.length > 1
                            ? recipients.length + " ontvangers"
                            : "Eén ontvanger"
                        : "Geen ontvangers"
                }}
            </template>
            <template #right>
                <LoadingButton :loading="sending">
                    <button class="button primary" @click="send" :disabled="emails.length == 0">
                        Versturen
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin, ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { STNavigationTitle, STInputBox, LoadingButton } from "@stamhoofd/components";
import { STToolbar } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { SegmentedControl } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";
import EmailSettingsView from '../settings/EmailSettingsView.vue';
import { SessionManager } from '@stamhoofd/networking';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import { MemberWithRegistrations, EmailRequest, Recipient, Replacement, Group } from '@stamhoofd/structures';

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        STToolbar,
        STInputBox,
        LoadingButton,
        MailEditor: () => import(/* webpackChunkName: "MailEditor" */ './MailEditor.vue'),
    },
})
export default class MailView extends Mixins(NavigationMixin) {
    @Prop()
    members!: MemberWithRegistrations[];
    sending = false

    @Prop({ default: null })
    group: Group | null

    // Make session (organization) reactive
    reactiveSession = SessionManager.currentSession

    emailId: string | null = this.group?.privateSettings?.defaultEmailId ?? this.emails.find(e => e.default)?.id ?? this.emails[0]?.id ?? null
    subject = ""

    get organization() {
        return OrganizationManager.organization
    }

    get recipients(): Recipient[] {
        return this.members.flatMap((member) => {
            if (!member.details) {
                return []
            }
            return member.details.parents.flatMap((parent) => {
                if (parent.email) {
                    return [Recipient.create({
                        firstName: parent.firstName,
                        email: parent.email,
                        replacements: [
                            Replacement.create({
                                token: "firstName",
                                value: parent.firstName
                            })
                        ]
                    })];
                }
                return [];
            });
        });
    }

    get emails() {
        return this.organization.privateMeta?.emails ?? []
    }

    manageEmails() {
        this.show(new ComponentWithProperties(EmailSettingsView, {}))
    }

    async send() {
        if (this.sending || !this.emailId) {
            return;
        }
        this.sending = true;

        try {
            let html = (this.$refs.editor as any).editor!.getHTML();

            const element = document.createElement("div")
            element.innerHTML = html

            const elements = element.querySelectorAll("span.replace-placeholder[data-replace-type='firstName']")
            for (const el of elements) {
                el.parentElement!.replaceChild(document.createTextNode("{{"+el.getAttribute("data-replace-type")+"}}"), el)
            }

            html = element.innerHTML

            const emailRequest = EmailRequest.create({
                emailId: this.emailId,
                recipients: this.recipients,
                subject: this.subject,
                html
            })

            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/email",
                body: emailRequest,
            })
            this.pop({ force: true })
        } catch (e) {
            console.error(e)
        }
        this.sending = false
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.mail-view {
    > main {
        display: flex;
        flex-grow: 1;
        flex-direction: column;

        #message-title {
            padding-bottom: 0;
        }

        & > .editor {
            flex-grow: 1;
            display: flex;
            flex-direction: column;

            justify-content: stretch;
            align-items: stretch;
            min-height: 200px;

            & > .editor-content {
                flex-grow: 1;
                display: flex;
                flex-direction: column;

                & > .ProseMirror {
                    flex-grow: 1;
                }
            }
        }
    }
}
</style>
