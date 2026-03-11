<template>
    <div id="dns-records-view" class="st-view">
        <STNavigationBar :title="$t(`56c85b34-a9f3-46ac-a77c-991a0f463c73`)" />

        <main>
            <h1>
                {{ $t('fab17919-181e-4ed5-a4b1-aca110d5200f') }}
            </h1>

            <p v-if="enableMemberModule">
                {{ $t('af699619-5a29-4df0-8c40-0047f6f5a7b3', {mailDomain, registerDomain}) }}
            </p>
            <p v-else>
                {{ $t('74bef3e3-7fad-483d-9232-9e6626a7ff30', {mailDomain}) }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="dismiss()">
                    {{ $t('83db2c73-38a3-4d13-9984-2f19f95e1329') }}
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { BackButton, Checkbox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, TooltipDirective } from '@stamhoofd/components';

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
