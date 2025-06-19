<template>
    <div id="dns-records-view" class="st-view">
        <STNavigationBar :title="$t(`bab38c80-8ab6-4cb7-80c3-1f607057e45d`)" />

        <main>
            <h1>
                {{ $t('7087e475-b3a9-492c-9d56-bfa3e763e713') }}
            </h1>

            <p>
                {{ $t('1b2d46a6-22a9-485f-bb00-84facfa33d85') }}
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <div v-for="record in records" :key="record.id">
                <DNSRecordBox :record="record" />
            </div>

            <p class="warning-box">
                {{ $t('136b3eb5-4c3a-46d5-87f1-25293225a875') }}
            </p>
            <p class="warning-box">
                {{ $t('e1f9cde6-19dd-4c2d-93f2-1d962c823d1f') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="validate">
                        {{ $t('381ebb39-0c79-4919-aa9c-b68375a98ad4') }}
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { BackButton, Checkbox, ErrorBox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, TooltipDirective } from '@stamhoofd/components';
import { Organization, OrganizationDomains } from '@stamhoofd/structures';

import DNSRecordBox from '../../../components/DNSRecordBox.vue';
import DNSRecordsDoneView from './DNSRecordsDoneView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton,
        DNSRecordBox,
    },
    directives: {
        tooltip: TooltipDirective,
    },
})
export default class DNSRecordsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    saving = false;

    session = this.$context;

    get records() {
        return this.$organization.privateMeta?.dnsRecords ?? [];
    }

    get mailDomain() {
        return this.$organization.privateMeta?.pendingMailDomain ?? this.$organization.privateMeta?.mailDomain ?? '?';
    }

    async validate() {
        if (this.saving) {
            return;
        }

        this.saving = true;

        try {
            const response = await this.$context.authenticatedServer.request({
                method: 'POST',
                path: '/organization/domain',
                body: OrganizationDomains.create({
                    mailDomain: this.mailDomain,
                    registerDomain: this.$organization.privateMeta?.pendingRegisterDomain ?? this.$organization.registerDomain,
                }),
                decoder: Organization as Decoder<Organization>,
            });

            this.$organization.deepSet(response.data);
            this.saving = false;

            if (response.data.privateMeta && response.data.privateMeta.mailDomain && response.data.privateMeta.pendingMailDomain === null && response.data.privateMeta.pendingRegisterDomain === null) {
                this.show(new ComponentWithProperties(DNSRecordsDoneView, {}));
            }
        }
        catch (e) {
            console.error(e);
            this.errorBox = new ErrorBox(e);
            this.saving = false;
        }

        // this.pop({ force: true })
    }
}
</script>
