<template>
    <div id="dns-records-view" class="st-view">
        <STNavigationBar :title="$t(`%xU`)" />

        <main>
            <h1>
                {{ $t('%My') }}
            </h1>

            <p>
                {{ $t('%Mz') }}
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <div v-for="record in records" :key="record.id">
                <DNSRecordBox :record="record" />
            </div>

            <p class="warning-box">
                {{ $t('%N0') }}
            </p>
            <p class="warning-box">
                {{ $t('%N1') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="validate">
                        {{ $t('%N2') }}
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { Organization, OrganizationDomains } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

import DNSRecordBox from '../../../components/DNSRecordBox.vue';


const context = useContext();
const organization = useRequiredOrganization();
const show = useShow();
const errorBox = ref<ErrorBox | null>(null);
const saving = ref(false);
const records = computed(() => organization.value.privateMeta?.dnsRecords ?? []);
const mailDomain = computed(() => organization.value.privateMeta?.pendingMailDomain ?? organization.value.privateMeta?.mailDomain ?? '?');

async function validate() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/organization/domain',
            body: OrganizationDomains.create({
                mailDomain: mailDomain.value,
                registerDomain: organization.value.privateMeta?.pendingRegisterDomain ?? organization.value.registerDomain,
            }),
            decoder: Organization as Decoder<Organization>,
        });

        context.value.updateOrganization(response.data);
        saving.value = false;

        if (response.data.privateMeta?.mailDomain && response.data.privateMeta.pendingMailDomain === null && response.data.privateMeta.pendingRegisterDomain === null) {
            await show(AsyncComponent(() => import('./DNSRecordsDoneView.vue'), {}));
        }
    } catch (e) {
        console.error(e);
        errorBox.value = new ErrorBox(e);
        saving.value = false;
    }
}
</script>
