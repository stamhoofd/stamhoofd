<template>
    <div id="settings-view" class="st-view">
        <STNavigationBar :title="$t(`e8340220-a719-4ab8-82ff-627fce627235`)" />

        <main>
            <h1>
                {{ $t('5faa331e-0104-4711-a394-4d8c449187b0') }}
            </h1>

            <p v-if="!isMailOk && !isRegisterOk" class="warning-box">
                {{ $t('fe25f9ee-ab8c-45f2-852c-f497483250e9', {email: $t('59b85264-c4c3-4cf6-8923-9b43282b2787')}) }}
            </p>
            <template v-else>
                <p v-if="isMailOk" class="success-box">
                    {{ $t('b7985e12-33ca-4c18-9b56-0d57e39c6dfa') }} <template v-if="!organization.privateMeta?.mailDomainActive">
                        {{ $t('52a60393-2b13-474b-a20c-80e61f9b8ff1') }}
                    </template>
                </p>
                <p v-else class="warning-box">
                    {{ $t('94547449-549d-4572-b217-c1a089b12997') }}
                </p>

                <template v-if="enableMemberModule">
                    <p v-if="isRegisterOk" class="success-box">
                        {{ $t('e086e262-f3e3-4018-822c-ad07c807d2d0', {registerDomain: organization.registerDomain ?? ''}) }}
                    </p>
                    <p v-else class="warning-box">
                        {{ $t("f4d007b9-61f4-44ba-b0a5-67f1b33f360d") }}
                    </p>
                </template>
            </template>

            <STErrorsDefault :error-box="errorBox" />

            <STInputBox error-fields="mailDomain" :error-box="errorBox" :title="$t(`30e5c996-ef97-4ad6-8503-049163cd197d`)">
                <input v-model="mailDomain" class="input" type="text" :placeholder="$t('d687b491-be68-4e5b-9acb-e2c090951c23')" @change="domainChanged">
            </STInputBox>
            <p v-if="mailDomain && enableMemberModule">
                {{ $t('7eb24df0-af88-42cf-b52f-7f59b5070255', {usedRegisterDomain, mailDomain}) }}
            </p>
            <p v-else-if="mailDomain">
                {{ $t('bd5418b3-5d06-43da-a0e6-4ced20644825', {mailDomain}) }}
            </p>

            <template v-if="isStamhoofd">
                <hr><h2>{{ $t('6a11d3a7-6348-4aca-893e-0f026e5eb8b0') }}</h2>

                <Checkbox v-model="useDkim1024bit">
                    {{ $t('b4c5c43a-e084-4bc3-b867-7d415fa29625') }}
                </Checkbox>

                <Checkbox v-model="allowSubdomain">
                    {{ $t('88e7b279-e108-48e6-a1fd-5df4fa94b029') }}
                </Checkbox>

                <Checkbox v-if="enableMemberModule" v-model="customRegisterDomain">
                    {{ $t('75913b92-4a79-4902-91ad-cb56e0549b7c') }}
                </Checkbox>
            </template>

            <STInputBox v-if="enableMemberModule && customRegisterDomain" error-fields="registerDomain" :error-box="errorBox" :title="$t(`ff993893-62e4-459c-88e2-54b5bf760c13`)">
                <input
                    v-model="registerDomain" class="input" type="text"
                    :placeholder="$t('a6d56271-af8e-40a4-9f23-1d29009d315e')"
                    @change="registerDomainChanged"
                >
            </STInputBox>
        </main>

        <STToolbar>
            <template #right>
                <button v-if="isAlreadySet" class="button secundary" type="button" @click="deleteMe">
                    <span class="icon trash" />
                    <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
                </button>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="save">
                        {{ $t('cbdf865f-5921-4c3d-9e81-b889c929e5c6') }}
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { BackButton, Checkbox, ErrorBox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from '@stamhoofd/components';
import { Organization, OrganizationDomains } from '@stamhoofd/structures';

import DNSRecordsView from './DNSRecordsView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton,
    },
})
export default class DomainSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    validator = new Validator();
    saving = false;
    useDkim1024bit = false;
    registerDomain = '';
    mailDomain = '';
    customRegisterDomain = false;
    allowSubdomain = true;

    created() {
        this.registerDomain = this.$organization.privateMeta?.pendingRegisterDomain ?? this.$organization.registerDomain ?? '';
        this.mailDomain = this.$organization.privateMeta?.pendingMailDomain ?? this.$organization.privateMeta?.mailDomain ?? '';
        this.customRegisterDomain = this.registerDomain && this.mailDomain ? (this.registerDomain !== 'inschrijven.' + this.mailDomain) : false;
        this.allowSubdomain = !!this.mailDomain.match(/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.[a-zA-Z]+$/);
    }

    validateDomain() {
        const d = this.mailDomain;
        if (this.allowSubdomain) {
            if (!d.match(/^([a-zA-Z0-9-]+\.)?[a-zA-Z0-9-]+\.[a-zA-Z]+$/)) {
                return false;
            }
            return true;
        }
        if (!d.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]+$/)) {
            return false;
        }
        return true;
    }

    validateRegisterDomain() {
        const d = this.registerDomain;
        if (!d.match(/^([a-zA-Z0-9-]+\.)?[a-zA-Z0-9-]+\.[a-zA-Z]+$/)) {
            return false;
        }
        return true;
    }

    get usedRegisterDomain() {
        return this.customRegisterDomain ? this.registerDomain : ('inschrijven.' + this.mailDomain);
    }

    get isStamhoofd() {
        return this.$organizationManager.user.email.endsWith('@stamhoofd.be') || this.$organizationManager.user.email.endsWith('@stamhoofd.nl');
    }

    get isMailOk() {
        return this.organization.privateMeta?.pendingMailDomain === null && this.organization.privateMeta?.mailDomain !== null;
    }

    get isRegisterOk() {
        return this.organization.privateMeta?.pendingRegisterDomain === null && this.organization.registerDomain !== null;
    }

    get organization() {
        return this.$organization;
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers;
    }

    get isAlreadySet() {
        return !!(this.$organization.privateMeta?.pendingMailDomain ?? this.$organization.privateMeta?.mailDomain);
    }

    domainChanged() {
        const errors = new SimpleErrors();

        if (!this.validateDomain()) {
            errors.addError(new SimpleError({
                code: 'invalid_field',
                message: 'De domeinnaam die je hebt ingevuld is niet geldig',
                field: 'mailDomain',
            }));
            this.errorBox = new ErrorBox(errors);
        }
        else {
            this.errorBox = null;
        }
    }

    registerDomainChanged() {
        const errors = new SimpleErrors();

        if (!this.validateRegisterDomain()) {
            errors.addError(new SimpleError({
                code: 'invalid_field',
                message: 'De domeinnaam die je hebt ingevuld is niet geldig',
                field: 'registerDomain',
            }));
            this.errorBox = new ErrorBox(errors);
        }
        else {
            this.errorBox = null;
        }
    }

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors();

        if (!this.validateDomain()) {
            errors.addError(new SimpleError({
                code: 'invalid_field',
                message: 'De domeinnaam die je hebt ingevuld is niet geldig',
                field: 'mailDomain',
            }));
        }

        if (this.customRegisterDomain && !this.validateRegisterDomain()) {
            errors.addError(new SimpleError({
                code: 'invalid_field',
                message: 'De domeinnaam die je hebt ingevuld is niet geldig',
                field: 'registerDomain',
            }));
        }

        let valid = false;

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors);
        }
        else {
            this.errorBox = null;
            valid = true;
        }
        valid = valid && await this.validator.validate();

        if (!valid) {
            return;
        }

        this.saving = true;

        try {
            const registerDomain = this.usedRegisterDomain;
            const response = await this.$context.authenticatedServer.request({
                method: 'POST',
                path: '/organization/domain',
                body: OrganizationDomains.create({
                    mailDomain: this.mailDomain,
                    registerDomain: (this.enableMemberModule || this.organization.registerDomain === registerDomain || this.organization.privateMeta?.pendingRegisterDomain === registerDomain) ? registerDomain : null,
                    useDkim1024bit: this.useDkim1024bit,
                }),
                decoder: Organization as Decoder<Organization>,
            });
            this.$organization.deepSet(response.data);
            this.show(new ComponentWithProperties(DNSRecordsView, {}));
            this.saving = false;
        }
        catch (e) {
            console.error(e);
            this.errorBox = new ErrorBox(e);
            this.saving = false;
        }

        // this.pop({ force: true })
    }

    async deleteMe() {
        if (this.saving) {
            return;
        }

        if (!confirm('Ben je zeker dat je jouw domeinnaam wilt loskoppelen?')) {
            return;
        }

        this.saving = true;

        try {
            const response = await this.$context.authenticatedServer.request({
                method: 'POST',
                path: '/organization/domain',
                body: OrganizationDomains.create({
                    mailDomain: null,
                    registerDomain: null,
                }),
                decoder: Organization as Decoder<Organization>,
            });

            this.$context.updateOrganization(response.data);
            this.pop({ force: true });
            this.saving = false;
        }
        catch (e) {
            console.error(e);
            this.errorBox = new ErrorBox(e);
            this.saving = false;
        }
    }
}
</script>

<style lang="scss">
#settings-view {
    .dns-settings {
        padding: 20px 0;
        max-width: 500px;;

        dd {
            font-family: monospace;
            white-space: nowrap;
        }
    }
}
</style>
