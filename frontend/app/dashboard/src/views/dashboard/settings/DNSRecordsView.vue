<template>
    <div id="dns-records-view" class="st-view">
        <STNavigationBar :title="$t(`a370eff9-c1c1-450c-8bdb-dcee89bd2f70`)"/>

        <main>
            <h1>
                {{ $t('b7537bc6-0373-4754-941c-71d6dbb1904b') }}
            </h1>

            <p class="st-list-description">
                {{ $t('efd1964f-1503-43b6-aeac-8338e3c8dba6') }}
            </p>

            <STErrorsDefault :error-box="errorBox"/>

            <div v-for="record in records" :key="record.id">
                <DNSRecordBox :record="record"/>
            </div>

            <p class="warning-box">
                {{ $t('5942fcf3-8e50-4fbe-a935-7608a8652ec0') }}
            </p>
            <p class="warning-box">
                {{ $t('a3f763c0-7268-48c1-8f49-1a857b28ff6f') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="validate">
                        {{ $t('29a5a9a4-89f6-415c-b15d-65bd0f60249b') }}
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { BackButton, Checkbox, ErrorBox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, TooltipDirective } from '@stamhoofd/components';
import { SessionManager } from '@stamhoofd/networking';
import { Organization, OrganizationDomains } from '@stamhoofd/structures';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';

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
