<template>
    <div id="settings-view" class="st-view">
        <STNavigationBar :title="$t(`%N3`)" />

        <main>
            <h1>
                {{ $t('%N3') }}
            </h1>

            <p v-if="!isMailOk && !isRegisterOk" class="warning-box">
                {{ $t('%N4', {email: $t('%2a')}) }}
            </p>
            <template v-else>
                <p v-if="isMailOk" class="success-box">
                    {{ $t('%N5') }} <template v-if="!organization.privateMeta?.mailDomainActive">
                        {{ $t('%N6') }}
                    </template>
                </p>
                <p v-else class="warning-box">
                    {{ $t('%43') }}
                </p>

                <template v-if="enableMemberModule">
                    <p v-if="isRegisterOk" class="success-box">
                        {{ $t('%N7', {registerDomain: organization.registerDomain ?? ''}) }}
                    </p>
                    <p v-else class="warning-box">
                        {{ $t("%ND") }}
                    </p>
                </template>
            </template>

            <STErrorsDefault :error-box="errorBox" />

            <STInputBox error-fields="mailDomain" :error-box="errorBox" :title="$t(`%NE`)">
                <input v-model="mailDomain" class="input" type="text" :placeholder="$t('%2o')" @change="domainChanged">
            </STInputBox>
            <p v-if="mailDomain && enableMemberModule">
                {{ $t('%N8', {usedRegisterDomain, mailDomain}) }}
            </p>
            <p v-else-if="mailDomain">
                {{ $t('%N9', {mailDomain}) }}
            </p>

            <template v-if="isStamhoofd">
                <hr><h2>{{ $t('%HQ') }}</h2>

                <Checkbox v-model="useDkim1024bit">
                    {{ $t('%NA') }}
                </Checkbox>

                <Checkbox v-model="allowSubdomain">
                    {{ $t('%NB') }}
                </Checkbox>

                <Checkbox v-if="enableMemberModule" v-model="customRegisterDomain">
                    {{ $t('%NC') }}
                </Checkbox>
            </template>

            <STInputBox v-if="enableMemberModule && customRegisterDomain" error-fields="registerDomain" :error-box="errorBox" :title="$t(`%NF`)">
                <input
                    v-model="registerDomain" class="input" type="text"
                    :placeholder="$t('%14f')"
                    @change="registerDomainChanged"
                >
            </STInputBox>
        </main>

        <STToolbar>
            <template #right>
                <button v-if="isAlreadySet" class="button secundary" type="button" @click="deleteMe">
                    <span class="icon trash" />
                    <span>{{ $t('%CJ') }}</span>
                </button>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="save">
                        {{ $t('%19q') }}
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import type { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import BackButton from '@stamhoofd/components/navigation/BackButton.vue';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
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
            await this.show(new ComponentWithProperties(DNSRecordsView, {}));
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
            await this.pop({ force: true });
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
