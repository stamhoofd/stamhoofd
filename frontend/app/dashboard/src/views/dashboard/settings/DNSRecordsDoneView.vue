<template>
    <div id="dns-records-view" class="st-view">
        <STNavigationBar :title="$t(`%zs`)" />

        <main>
            <h1>
                {{ $t('%Mv') }}
            </h1>

            <p v-if="enableMemberModule">
                {{ $t('%Mw', {mailDomain, registerDomain}) }}
            </p>
            <p v-else>
                {{ $t('%Mx', {mailDomain}) }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="dismiss()">
                    {{ $t('%9b') }}
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
