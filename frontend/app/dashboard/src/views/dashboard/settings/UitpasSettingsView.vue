<template>
    <div id="settings-view" class="st-view">
        <STNavigationBar :title="$t('%1Bf')" />

        <main>
            <h1>{{ $t('%1Bi') }}</h1>

            <p>
                <I18nComponent :t="$t('%1Bj')">
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
                        {{ $t('%1Bk') }}
                    </h3>

                    <p class="style-description">
                        {{ uitpasOrganizerId ? uitpasOrganizerName : $t('%1Bl') }}
                    </p>

                    <template #right>
                        <span class="button text">
                            {{ uitpasOrganizerId ? $t('%1Bm') : $t('%KC') }}
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
                        {{ $t('%1Bn') }}
                    </h3>

                    <p class="style-description">
                        {{ UitpasClientCredentialsStatusHelper.getName(uitpasClientCredentialsStatus) }}
                    </p>

                    <template #right>
                        <span v-if="uitpasOrganizerId" class="button text">
                            {{ uitpasClientCredentialsStatus === UitpasClientCredentialsStatus.NotConfigured ? $t('%1Bo') : $t('%1Bm') }}
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
                        {{ $t('%1Bp') }}
                    </h3>

                    <p class="style-description">
                        {{ uitpasEvent?.name ?? $t('%1Bq') }}
                    </p>

                    <template #right>
                        <span v-if="!!uitpasOrganizerId && uitpasClientCredentialsStatus === UitpasClientCredentialsStatus.Ok" class="button text">
                            {{ uitpasEvent ? $t('%1Bm') : $t('%KC') }}
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
import type { UitpasOrganizerResponse, UitpasEventResponse } from '@stamhoofd/structures';
import { OrganizationMetaData, UitpasClientCredentialsStatus, UitpasClientCredentialsStatusHelper } from '@stamhoofd/structures';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import SearchUitpasOrganizerView from '@stamhoofd/components/organizations/components/SearchUitpasOrganizerView.vue';
import SetUitpasClientCredentialsView from '@stamhoofd/components/organizations/components/SetUitpasClientCredentialsView.vue';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import ProgressIcon from '@stamhoofd/components/icons/ProgressIcon.vue';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import SearchUitpasEventView from '@stamhoofd/components/organizations/components/SearchUitpasEventView.vue';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';

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
            title: $t('%1Br'),
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
                title: $t('%1Bs'),
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
