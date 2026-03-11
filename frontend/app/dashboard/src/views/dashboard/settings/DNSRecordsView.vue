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
