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
            <p v-if="mailDomain && enableMemberModule" class="style-description-small">
                {{ $t('%N8', {usedRegisterDomain, mailDomain}) }}
            </p>
            <p v-else-if="mailDomain" class="style-description-small">
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

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { Organization, OrganizationDomains } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';

const context = useContext();
const organization = useRequiredOrganization();
const organizationManager = useOrganizationManager();
const show = useShow();
const pop = usePop();
const errorBox = ref<ErrorBox | null>(null);
const validator = new Validator();
const saving = ref(false);
const useDkim1024bit = ref(false);
const registerDomain = ref(organization.value.privateMeta?.pendingRegisterDomain ?? organization.value.registerDomain ?? '');
const mailDomain = ref(organization.value.privateMeta?.pendingMailDomain ?? organization.value.privateMeta?.mailDomain ?? '');
const customRegisterDomain = ref(!!registerDomain.value && !!mailDomain.value && registerDomain.value !== 'inschrijven.' + mailDomain.value);
const allowSubdomain = ref(/^[a-z0-9-]+\.[a-z0-9-]+\.[a-z]+$/i.test(mailDomain.value));
const usedRegisterDomain = computed(() => customRegisterDomain.value ? registerDomain.value : 'inschrijven.' + mailDomain.value);
const isStamhoofd = computed(() => organizationManager.value.user.email.endsWith('@stamhoofd.be') || organizationManager.value.user.email.endsWith('@stamhoofd.nl'));
const isMailOk = computed(() => organization.value.privateMeta?.pendingMailDomain === null && organization.value.privateMeta?.mailDomain !== null);
const isRegisterOk = computed(() => organization.value.privateMeta?.pendingRegisterDomain === null && organization.value.registerDomain !== null);
const enableMemberModule = computed(() => organization.value.meta.modules.useMembers);
const isAlreadySet = computed(() => !!(organization.value.privateMeta?.pendingMailDomain ?? organization.value.privateMeta?.mailDomain));

function validateDomain() {
    if (STAMHOOFD.environment === 'development') {
        return true;
    }

    if (allowSubdomain.value) {
        return /^(?:[a-z0-9-]+\.)?[a-z0-9-]+\.[a-z]+$/i.test(mailDomain.value);
    }
    return /^[a-z0-9-]+\.[a-z]+$/i.test(mailDomain.value);
}

const validateRegisterDomain = () => STAMHOOFD.environment === 'development' || /^(?:[a-z0-9-]+\.)?[a-z0-9-]+\.[a-z]+$/i.test(registerDomain.value);

function domainChanged() {
    if (!validateDomain()) {
        const errors = new SimpleErrors();
        errors.addError(new SimpleError({ code: 'invalid_field', message: $t('De domeinnaam die je hebt ingevuld is niet geldig'), field: 'mailDomain' }));
        errorBox.value = new ErrorBox(errors);
    } else {
        errorBox.value = null;
    }
}

function registerDomainChanged() {
    if (!validateRegisterDomain()) {
        const errors = new SimpleErrors();
        errors.addError(new SimpleError({ code: 'invalid_field', message: $t('De domeinnaam die je hebt ingevuld is niet geldig'), field: 'registerDomain' }));
        errorBox.value = new ErrorBox(errors);
    } else {
        errorBox.value = null;
    }
}

async function save() {
    if (saving.value) {
        return;
    }

    const errors = new SimpleErrors();
    if (!validateDomain()) {
        errors.addError(new SimpleError({ code: 'invalid_field', message: $t('De domeinnaam die je hebt ingevuld is niet geldig'), field: 'mailDomain' }));
    }
    if (customRegisterDomain.value && !validateRegisterDomain()) {
        errors.addError(new SimpleError({ code: 'invalid_field', message: $t('De domeinnaam die je hebt ingevuld is niet geldig'), field: 'registerDomain' }));
    }

    errorBox.value = errors.errors.length ? new ErrorBox(errors) : null;
    if (errors.errors.length || !await validator.validate()) {
        return;
    }

    saving.value = true;
    try {
        const domain = usedRegisterDomain.value;
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/organization/domain',
            body: OrganizationDomains.create({
                mailDomain: mailDomain.value,
                registerDomain: (enableMemberModule.value || organization.value.registerDomain === domain || organization.value.privateMeta?.pendingRegisterDomain === domain) ? domain : null,
                useDkim1024bit: useDkim1024bit.value,
            }),
            decoder: Organization as Decoder<Organization>,
        });
        context.value.updateOrganization(response.data);
        await show(AsyncComponent(() => import('./DNSRecordsView.vue'), {}));
    } catch (e) {
        console.error(e);
        errorBox.value = new ErrorBox(e);
    }
    saving.value = false;
}

async function deleteMe() {
    if (saving.value) {
        return;
    }

    if (!await CenteredMessage.confirm({
        title: $t('Ben je zeker dat je jouw domeinnaam wilt loskoppelen?'),
        confirmText: $t('Ja, loskoppelen'),
    })) {
        return;
    }
    saving.value = true;
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/organization/domain',
            body: OrganizationDomains.create({ mailDomain: null, registerDomain: null }),
            decoder: Organization as Decoder<Organization>,
        });
        context.value.updateOrganization(response.data);
        await pop({ force: true });
    } catch (e) {
        console.error(e);
        errorBox.value = new ErrorBox(e);
    }
    saving.value = false;
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
