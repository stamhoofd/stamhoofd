<template>
    <div id="settings-view" class="st-view">
        <STNavigationBar :title="$t('c112eac2-2515-4476-81d1-e8dc51bc063c')" />

        <main>
            <h1>{{ $t('bb419e01-886f-47b1-b1d9-2a3ef7094c92') }}</h1>

            <p>
                <I18nComponent :t="$t('50c110d0-67dd-4733-9fb1-49a1a541e2bd')">
                    <template #button="{content}">
                        <a class="inline-link" href="https://platform.publiq.be/nl" target="_blank">
                            {{ content }}
                        </a>
                    </template>
                </I18nComponent>
            </p>
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
                        {{ $t('549c952e-347f-4b1d-ae55-b645636e2522') }}
                    </h3>

                    <p class="style-description">
                        {{ uitpasOrganizerId ? uitpasOrganizerName : $t('87e8488b-4190-42d9-bdd0-564a46671f7f') }}
                    </p>

                    <template #right>
                        <span class="button text">
                            {{ uitpasOrganizerId ? $t('3b95fc70-7928-426b-b65b-3389d9e762cc') : $t('8012defc-bf79-4ee5-b8f4-6e6cc5242bf8') }}
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
                        {{ $t('0c503313-92c1-4063-887d-87bbff5a6e53') }}
                    </h3>

                    <p class="style-description">
                        {{ UitpasClientCredentialsStatusHelper.getName(uitpasClientCredentialsStatus) }}
                    </p>

                    <template #right>
                        <span v-if="uitpasOrganizerId" class="button text">
                            {{ uitpasClientCredentialsStatus === UitpasClientCredentialsStatus.NotConfigured ? $t('aa6ef361-7d1f-4a9a-a7e1-644958739117') : $t('3b95fc70-7928-426b-b65b-3389d9e762cc') }}
                            <span class="icon arrow-right-small" />
                        </span>
                    </template>
                </STListItem>
                <STListItem
                    v-if="stepForEventSelectionNeeded"
                    :selectable="!!uitpasOrganizerId && uitpasClientCredentialsStatus === UitpasClientCredentialsStatus.Ok"
                    :disabled="!uitpasOrganizerId || uitpasClientCredentialsStatus !== UitpasClientCredentialsStatus.Ok"
                    @click="(!!uitpasOrganizerId && uitpasClientCredentialsStatus === UitpasClientCredentialsStatus.Ok) ? openSearchUitpasEvent() : undefined"
                >
                    <template #left>
                        <IconContainer :icon="'calendar'" :class="uitpasEventSuccess ? 'success' : 'gray'">
                            <template #aside>
                                <ProgressIcon :icon="uitpasEventSuccess ? 'success' : undefined" />
                            </template>
                        </IconContainer>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('1e92a151-6161-4941-aa3f-fa69e14f75ee') }}
                    </h3>

                    <p class="style-description">
                        {{ uitpasEvent?.name ?? $t('c4fa8a72-56cd-4b5c-ae12-6533a493bac6') }}
                    </p>

                    <template #right>
                        <span v-if="!!uitpasOrganizerId && uitpasClientCredentialsStatus === UitpasClientCredentialsStatus.Ok" class="button text">
                            {{ uitpasEvent ? $t('3b95fc70-7928-426b-b65b-3389d9e762cc') : $t('8012defc-bf79-4ee5-b8f4-6e6cc5242bf8') }}
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
import { OrganizationMetaData, UitpasOrganizerResponse, UitpasClientCredentialsStatus, UitpasClientCredentialsStatusHelper, UitpasEventResponse } from '@stamhoofd/structures';
import { NavigationActions, SearchUitpasOrganizerView, SetUitpasClientCredentialsView, IconContainer, ProgressIcon, usePatch, SearchUitpasEventView, useNavigationActions } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking';
import { I18nComponent } from '@stamhoofd/frontend-i18n';

const show = useShow();
const present = usePresent();
const organizationManager = useOrganizationManager();
const { patched, addPatch, patch } = usePatch(organizationManager.value.organization);
const navigationActions = useNavigationActions();

const props = withDefaults(defineProps<{
    initialUitpasEvent?: UitpasEventResponse | null;
    onFixedAndEventSelected?: ((event: UitpasEventResponse, navigationActions: NavigationActions) => Promise<void>) | null;
}>(), {
    initialUitpasEvent: null,
    onFixedAndEventSelected: null,
});

const stepForEventSelectionNeeded = !!props.onFixedAndEventSelected;
const uitpasEvent = ref<UitpasEventResponse | null>(props.initialUitpasEvent);

const uitpasEventSuccess = computed(() => {
    return !!uitpasOrganizerId.value && uitpasClientCredentialsStatus.value === UitpasClientCredentialsStatus.Ok && uitpasEvent.value;
});

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
            title: $t('2c7dc287-58ab-423b-984a-b0582c992b4d'),
            selectOrganizer: async (organizer: UitpasOrganizerResponse, { pop }: NavigationActions) => {
                uitpasOrganizerName.value = organizer.name;
                uitpasOrganizerId.value = organizer.id;
                await organizationManager.value.patch(patch.value);
                if (props.onFixedAndEventSelected && uitpasClientCredentialsStatus.value === UitpasClientCredentialsStatus.Ok && uitpasEvent.value) {
                    await props.onFixedAndEventSelected(uitpasEvent.value, navigationActions);
                }
                else {
                    await pop({ force: true });
                }
            },
        }),
    );
};

const openSetUitpasClientCredentialsView = async () => {
    present({
        components: [
            new ComponentWithProperties(SetUitpasClientCredentialsView, {
                onFixed: async ({ dismiss }: NavigationActions) => {
                    await dismiss({ force: true });
                    if (props.onFixedAndEventSelected && uitpasEvent.value) {
                        await props.onFixedAndEventSelected(uitpasEvent.value, navigationActions);
                    }
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
};

const openSearchUitpasEvent = async () => {
    await show({
        components: [
            new ComponentWithProperties(SearchUitpasEventView, {
                title: $t('d37c7255-33dd-42a8-872d-0c719307f842'),
                selectEvent: async (event: UitpasEventResponse | null, navigationActions: NavigationActions) => {
                    uitpasEvent.value = event;
                    if (props.onFixedAndEventSelected && uitpasClientCredentialsStatus.value === UitpasClientCredentialsStatus.Ok && event) {
                        await props.onFixedAndEventSelected(event, navigationActions);
                    }
                    else {
                        await navigationActions.pop({ force: true });
                    }
                },
                showNoteAboutNonOfficialFlow: false, // we are specifically going to settings to use the official flow
            }),
        ],
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
