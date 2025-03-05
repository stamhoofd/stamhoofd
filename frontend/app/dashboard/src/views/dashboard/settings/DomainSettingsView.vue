<template>
    <div id="settings-view" class="st-view">
        <STNavigationBar :title="$t(`Domeinnaam kiezen`)"/>

        <main>
            <h1>
                {{ $t('d0f64e25-fc15-493a-b99e-d925e5de21a5') }}
            </h1>

            <p v-if="!isMailOk && !isRegisterOk" class="warning-box">
                {{ $t('e1e88049-0f30-475d-ac7f-de94d8f85010') }} {{ $t('59b85264-c4c3-4cf6-8923-9b43282b2787') }} {{ $t('2c8896bb-9fb1-4be2-a77c-e9d9d2d7c19c') }}
            </p>
            <template v-else>
                <p v-if="isMailOk" class="success-box">
                    {{ $t('642b317f-4516-42da-a6ea-6cfa40c9f8be') }} <template v-if="!organization.privateMeta.mailDomainActive">
                        {{ $t('249283b6-8d9e-4a01-a542-d46869f21d3f') }}
                    </template>
                </p>
                <p v-else class="warning-box">
                    {{ $t('94547449-549d-4572-b217-c1a089b12997') }}
                </p>

                <template v-if="enableMemberModule">
                    <p v-if="isRegisterOk" class="success-box">
                        {{ $t('7325092e-4648-4c9e-a288-ec37c8c411d5') }} {{ organization.registerDomain }})
                    </p>
                    <p v-else class="warning-box">
                        {{ $t("e6ef0954-76a1-4cd4-9092-bca9d255dda0") }}
                    </p>
                </template>
            </template>

            <STErrorsDefault :error-box="errorBox"/>

            <STInputBox error-fields="mailDomain" :error-box="errorBox" :title="$t(`838c80f3-bf67-48eb-9475-5ac3a45ad28e`)">
                <input v-model="mailDomain" class="input" type="text" :placeholder="$t('d687b491-be68-4e5b-9acb-e2c090951c23')" @change="domainChanged"></STInputBox>
            <p v-if="mailDomain && enableMemberModule" class="st-list-description">
                {{ $t('1bd2f1a1-ee8b-4a81-9a7f-1fc58b08869f') }} {{ usedRegisterDomain }} nadat je het instellen hebt voltooid. Je kan dan ook e-mails versturen vanaf @{{ mailDomain }}.
            </p>
            <p v-else-if="mailDomain" class="st-list-description">
                {{ $t('5ddb6577-148b-4592-a223-90f86a5094c1') }}{{ mailDomain }} {{ $t('8e47c9bf-1839-42fe-93c1-295a372d5764') }}
            </p>

            <template v-if="isStamhoofd">
                <hr><h2>{{ $t('2dfdb75f-fd62-45df-bc9f-a34a5570dd32') }}</h2>

                <Checkbox v-model="useDkim1024bit">
                    {{ $t('79bbdce5-e777-4288-9550-b8e65cebd2ff') }}
                </Checkbox>

                <Checkbox v-model="allowSubdomain">
                    {{ $t('291cb2a0-8708-4a49-ba1f-a0c7349c1834') }}
                </Checkbox>

                <Checkbox v-if="enableMemberModule" v-model="customRegisterDomain">
                    {{ $t('0b121c3e-d80b-4c15-9511-483ddcf6c0ac') }}
                </Checkbox>
            </template>

            <STInputBox v-if="enableMemberModule && customRegisterDomain" error-fields="registerDomain" :error-box="errorBox" :title="$t(`4363a2d4-e434-4c73-b648-2a5e3be13028`)">
                <input v-model="registerDomain" class="input" type="text" :placeholder="$t(`d8f2beb3-8e90-4480-98a0-3f0de3687b70`) + $t('d687b491-be68-4e5b-9acb-e2c090951c23')" @change="registerDomainChanged"></STInputBox>
        </main>

        <STToolbar>
            <template #right>
                <button v-if="isAlreadySet" class="button secundary" type="button" @click="deleteMe">
                    <span class="icon trash"/>
                    <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
                </button>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="save">
                        {{ $t('db8dfeda-0014-420f-98e7-acf4e203b0fc') }}
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
    registerDomain = this.$organization.privateMeta?.pendingRegisterDomain ?? this.$organization.registerDomain ?? '';
    mailDomain = this.$organization.privateMeta?.pendingMailDomain ?? this.$organization.privateMeta?.mailDomain ?? '';
    customRegisterDomain = this.registerDomain && this.mailDomain && (this.registerDomain !== 'inschrijven.' + this.mailDomain);
    allowSubdomain = !!this.mailDomain.match(/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.[a-zA-Z]+$/);

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
