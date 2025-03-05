<template>
    <div id="dns-records-view" class="st-view">
        <STNavigationBar :title="$t(`3f2e5984-f9e2-4b1f-bd33-acaa039d5cee`)"/>

        <main>
            <h1>
                {{ $t('f35798dd-9608-49c7-a0f0-602f17ec6fd5') }}
            </h1>

            <p v-if="enableMemberModule" class="st-list-description">
                {{ $t('5b2bad02-3a2d-41d2-a914-eb87f0b5fa4d') }}{{ mailDomain }} verstuurd. Jullie ledenportaal zal waarschijnlijk al iets sneller beschikbaar zijn op {{ registerDomain }}.
            </p>
            <p v-else class="st-list-description">
                {{ $t('706eaa43-c677-4aa8-8778-401d347bc508') }}{{ mailDomain }} {{ $t('3fbba2b3-4c3e-496b-992e-50ef4ffa8c80') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" @click="dismiss">
                    {{ $t('08919911-1157-400d-b89c-265233590019') }}
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { BackButton, Checkbox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, TooltipDirective } from '@stamhoofd/components';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';

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
    directives: {
        tooltip: TooltipDirective,
    },
})
export default class DNSRecordsDoneView extends Mixins(NavigationMixin) {
    get organization() {
        return this.$organization;
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers;
    }

    get registerDomain() {
        return this.$organization.registerDomain ?? '?';
    }

    get mailDomain() {
        return this.$organization.privateMeta?.mailDomain ?? '?';
    }
}
</script>
