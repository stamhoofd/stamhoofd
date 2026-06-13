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

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { computed } from 'vue';

const organization = useRequiredOrganization();
const dismiss = useDismiss();
const enableMemberModule = computed(() => organization.value.meta.modules.useMembers);
const registerDomain = computed(() => organization.value.registerDomain ?? '?');
const mailDomain = computed(() => organization.value.privateMeta?.mailDomain ?? '?');
</script>
