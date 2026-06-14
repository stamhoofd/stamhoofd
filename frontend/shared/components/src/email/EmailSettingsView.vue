<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`%vG`)" />

        <main>
            <h1>
                {{ $t('%1EJ') }}
            </h1>

            <p>{{ $t('%aY') }} <a class="inline-link" :href="$domains.getDocs('e-mailadressen-instellen')" target="_blank">{{ $t('%OH') }}</a>.</p>

            <STList>
                <STListItem v-for="email in emails" :key="email.id" :selectable="true" class="right-stack" @click="editEmail(email)">
                    <template #left>
                        <IconContainer icon="email-filled" :class="email.default ? 'success' : ''" :aside-icon="email.default ? 'success' : ''" />
                    </template>

                    <h3 class="style-title-list">
                        <span>{{ email.name ? email.name : email.email }}</span>
                        <span v-if="email.default" class="style-tag success">{{ $t('%v6') }}</span>
                    </h3>
                    <p v-if="email.name" class="style-description-small">
                        {{ email.email }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <p v-if="emails.length === 0" class="info-box">
                {{ $t('%aZ') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="addEmail">
                    <span class="icon add" />
                    <span>{{ $t('%aR') }}</span>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import IconContainer from '#icons/IconContainer.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { OrganizationEmail } from '@stamhoofd/structures';

import { computed } from 'vue';


const organization = useOrganization();
const platform = usePlatform();
const emails = computed(() => (organization.value ? organization.value.privateMeta?.emails : platform.value.privateConfig?.emails) ?? []);

const present = usePresent();

async function editEmail(email: OrganizationEmail) {
    await present({
        components: [
            AsyncComponent(() => import('./EditEmailView.vue'), {
                email,
                isNew: false,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function addEmail() {
    const email = OrganizationEmail.create({ email: '' });
    await present({
        components: [
            AsyncComponent(() => import('./EditEmailView.vue'), {
                email,
                isNew: true,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
