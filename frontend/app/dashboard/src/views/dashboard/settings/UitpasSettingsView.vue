<template>
    <div id="settings-view" class="st-view">
        <STNavigationBar :title="$t('Koppel je UiTPAS-organisator')" />

        <main>
            <h1>{{ $t('Koppel je UiTPAS-organisator') }}</h1>

            <STErrorsDefault :error-box="errorBox" />

            <STList>
                <STListItem
                    :selectable="true"
                    @click="openSearchOrganizer"
                >
                    <template #left>
                        <IconContainer :icon="'file-filled'" :class="uitpasOrganizerId ? 'success' : 'gray'">
                            <template #aside>
                                <ProgressIcon :icon="uitpasOrganizerId ? 'success' : undefined" :progress="uitpasOrganizerId ? 1 : 0" />
                            </template>
                        </IconContainer>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('UiTPAS-organisator') }}
                    </h3>

                    <p class="style-description">
                        {{ uitpasOrganizerId ? uitpasOrganizerName : $t('Zoek jouw vereniging in de UiTPAS organisatoren lijst.') }}
                    </p>

                    <template #right>
                        <span class="button text">
                            {{ uitpasOrganizerId ? $t('Wijzig') : $t('Zoeken') }}
                            <span class="icon arrow-right-small" />
                        </span>
                    </template>
                </STListItem>

                <STListItem
                    :selectable="!!uitpasOrganizerId"
                    :disabled="!uitpasOrganizerId"
                    @click="!!uitpasOrganizerId ? openSetUitpasClientCredentialsView() : undefined"
                >
                    <template #left>
                        <IconContainer :icon="'key'" :class="UitpasClientCredentialsStatusHelper.getColor(uitpasClientCredentialsStatus)">
                            <template #aside>
                                <ProgressIcon :icon="uitpasClientCredentialsStatus === UitpasClientCredentialsStatus.Ok ? 'success' : undefined" />
                            </template>
                        </IconContainer>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('Configuur UiTPAS-integratie') }}
                    </h3>

                    <p class="style-description">
                        {{ UitpasClientCredentialsStatusHelper.getName(uitpasClientCredentialsStatus) }}
                    </p>

                    <template #right>
                        <span v-if="uitpasOrganizerId" class="button text">
                            {{ uitpasClientCredentialsStatus === UitpasClientCredentialsStatus.NotConfigured ? $t('Configureer') : $t('Wijzig') }}
                            <span class="icon arrow-right-small" />
                        </span>
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { ComponentWithProperties, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { OrganizationMetaData, UitpasOrganizerResponse, UitpasClientCredentialsStatus, UitpasClientCredentialsStatusHelper, UitpasClientIdAndSecret } from '@stamhoofd/structures';
import { NavigationActions, SearchUitpasOrganizerView, SetUitpasClientCredentialsView, IconContainer, ProgressIcon, usePatch } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking';

const show = useShow();
const present = usePresent();
const organizationManager = useOrganizationManager();
const { patched, addPatch, patch } = usePatch(organizationManager.value.organization);

// Make sure the property exists in your Organization type, otherwise use the correct property name.
// For example, if the correct property is 'meta', update the meta object:
const uitpasOrganizerName = computed({
    get: () => patched.value.meta.uitpasOrganizerName,
    set: (value) => {
        addPatch({ meta: OrganizationMetaData.patch({
            uitpasOrganizerName: value,
        }) });
    },
});

const uitpasOrganizerId = computed({
    get: () => patched.value.meta.uitpasOrganizerId,
    set: (value) => {
        addPatch({ meta: OrganizationMetaData.patch({
            uitpasOrganizerId: value,
        }) });
    },
});

const uitpasClientCredentialsStatus = computed(() => organizationManager.value.organization.meta.uitpasClientCredentialsStatus);

const openSearchOrganizer = async () => {
    await show(
        new ComponentWithProperties(SearchUitpasOrganizerView, {
            title: $t('Zoek je UiTPAS-organisator'),
            selectOrganizer: async (organizer: UitpasOrganizerResponse, { pop }: NavigationActions) => {
                uitpasOrganizerName.value = organizer.name;
                uitpasOrganizerId.value = organizer.id;
                await organizationManager.value.patch(patch.value);
                await pop({ force: true });
            },
        }),
    );
};

const openSetUitpasClientCredentialsView = async () => {
    const u = new UitpasClientIdAndSecret();
    u.clientId = '';
    u.clientSecret = '';
    // TO DO proper getting using endpoint
    present({
        components: [
            new ComponentWithProperties(SetUitpasClientCredentialsView, {}),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
};

// Optional: define or pass in actual errorBox if needed
const errorBox = ref(null);

</script>

<style lang="scss">
#settings-view {
  .dns-settings {
    padding: 20px 0;
    max-width: 500px;

    dd {
      font-family: monospace;
      white-space: nowrap;
    }
  }
}
</style>
