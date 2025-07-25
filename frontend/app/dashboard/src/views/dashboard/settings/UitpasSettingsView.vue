<template>
    <div id="settings-view" class="st-view">
        <STNavigationBar :title="$t('Koppel je UiTPAS-organisator')" />

        <main>
            <h1>{{ $t('Koppel met UiTPAS') }}</h1>

            <p>
                <I18nComponent :t="$t('Door #platform en UiTPAS aan elkaar te koppelen kan je een automatische terugbetaling krijgen voor elke verkoop met UiTPAS-kansentarief. Eerst moet je een officiële UiTPAS-organisator worden, zo weet men aan wie de terugbetaling moet gebeuren. Nadien moet je een integratie aanmaken op de website van <button>Publiq</button>. Geef nadien de gegevens van die integratie hieronder in. Tot slot zal je bij elk artikel uit de webshop een evenement uit de UiTdatabank moeten koppelen.')">
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
                        {{ $t('UiTPAS-evenement') }}
                    </h3>

                    <p class="style-description">
                        {{ uitpasEvent?.name ?? $t('Zoek jouw evenement in de UiTPAS lijst.') }}
                    </p>

                    <template #right>
                        <span v-if="!!uitpasOrganizerId && uitpasClientCredentialsStatus === UitpasClientCredentialsStatus.Ok" class="button text">
                            {{ uitpasEvent ? $t('Wijzig') : $t('Zoeken') }}
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
            title: $t('Zoek je UiTPAS-organisator'),
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
        }).setDisplayStyle('popup'),
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
                title: $t('Zoek je UiTPAS-evenement'),
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
