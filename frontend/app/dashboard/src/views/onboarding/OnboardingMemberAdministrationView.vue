<template>
    <SaveView :title="title" :save-text="$t('%19q')" save-icon-right="arrow-right" :loading="saving" :prefer-large-button="true" @save="goNext">
        <aside class="style-title-prefix">
            {{ $t('%1WP', { current: props.stepNumber.toString(), total: props.stepCount.toString() }) }}
        </aside>
        <h1>
            {{ title }}
        </h1>
        <p>
            {{ $t('%1a5') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox v-if="broadType === OrganizationType.Sport" :title="$t('%1c0')" error-fields="sport" :error-box="errors.errorBox" class="max">
            <Dropdown v-model="sportType">
                <option v-for="option in sportOptions" :key="option.value" :value="option.value">
                    {{ option.name }}
                </option>
            </Dropdown>
        </STInputBox>

        <STInputBox v-if="broadType === OrganizationType.Youth" :title="$t('%1XL')" error-fields="umbrellaOrganization" :error-box="errors.errorBox" class="max">
            <Dropdown v-model="umbrellaOrganization">
                <option :value="null">
                    {{ $t('%1br') }}
                </option>
                <option v-for="option in umbrellaOptions" :key="option.value" :value="option.value">
                    {{ option.name }}
                </option>
            </Dropdown>
        </STInputBox>
    </SaveView>
</template>

<script setup lang="ts">
import bikeIllustration from '@stamhoofd/assets/images/illustrations/bike.svg';
import charityIllustration from '@stamhoofd/assets/images/illustrations/charity.svg';
import educationIllustration from '@stamhoofd/assets/images/illustrations/education.svg';
import stageIllustration from '@stamhoofd/assets/images/illustrations/stage.svg';
import teamIllustration from '@stamhoofd/assets/images/illustrations/team.svg';
import tentIllustration from '@stamhoofd/assets/images/illustrations/tent.svg';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { Organization, OrganizationMetaData, OrganizationType, OrganizationTypeHelper, UmbrellaOrganization, UmbrellaOrganizationHelper } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import type { OnboardingStepProps } from './useMemberAdministrationOnboarding';

const props = defineProps<OnboardingStepProps>();
const navigationActions = useNavigationActions();
const organizationManager = useOrganizationManager();
const errors = useErrors();
const saving = ref(false);

const title = $t('%1W5');

const organization = props.viewModel.organization;

const broadOptions: { value: OrganizationType; title: string; imgSrc: string }[] = [
    { value: OrganizationType.Sport, title: OrganizationTypeHelper.getName(OrganizationType.Sport), imgSrc: bikeIllustration },
    { value: OrganizationType.Culture, title: OrganizationTypeHelper.getName(OrganizationType.Culture), imgSrc: stageIllustration },
    { value: OrganizationType.Youth, title: OrganizationTypeHelper.getName(OrganizationType.Youth), imgSrc: tentIllustration },
    { value: OrganizationType.School, title: OrganizationTypeHelper.getName(OrganizationType.School), imgSrc: educationIllustration },
    { value: OrganizationType.GoodCause, title: OrganizationTypeHelper.getName(OrganizationType.GoodCause), imgSrc: charityIllustration },
    { value: OrganizationType.Other, title: OrganizationTypeHelper.getName(OrganizationType.Other), imgSrc: teamIllustration },
];

// Concrete sports (including the generic "Sport") share the same category as Sport.
const sportOptions = OrganizationTypeHelper.getList().filter(o => OrganizationTypeHelper.getCategory(o.value) === OrganizationTypeHelper.getCategory(OrganizationType.Sport));
const umbrellaOptions = UmbrellaOrganizationHelper.getList().filter(o => o.value !== UmbrellaOrganization.Other);

/**
 * Maps a (possibly concrete) organization type to one of the broad options shown above.
 */
function broadFor(type: OrganizationType): OrganizationType {
    if (broadOptions.some(o => o.value === type)) {
        return type;
    }
    const category = OrganizationTypeHelper.getCategory(type);
    if (category === OrganizationTypeHelper.getCategory(OrganizationType.Sport)) {
        return OrganizationType.Sport;
    }
    if (category === OrganizationTypeHelper.getCategory(OrganizationType.Youth)) {
        return OrganizationType.Youth;
    }
    if (category === OrganizationTypeHelper.getCategory(OrganizationType.Culture)) {
        return OrganizationType.Culture;
    }
    if (category === OrganizationTypeHelper.getCategory(OrganizationType.School)) {
        return OrganizationType.School;
    }
    return OrganizationType.Other;
}

const broadType = ref<OrganizationType>(broadFor(organization.meta.type));
const sportType = ref<OrganizationType>(broadFor(organization.meta.type) === OrganizationType.Sport ? organization.meta.type : OrganizationType.Sport);
const umbrellaOrganization = ref<UmbrellaOrganization | null>(organization.meta.umbrellaOrganization);

// The concrete organization type we will store
const resolvedType = computed(() => broadType.value === OrganizationType.Sport ? sportType.value : broadType.value);
const resolvedUmbrella = computed(() => broadType.value === OrganizationType.Youth ? umbrellaOrganization.value : null);

async function goNext() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    errors.errorBox = null;

    try {
        const metaPatch = OrganizationMetaData.patch({
            type: resolvedType.value,
            umbrellaOrganization: resolvedUmbrella.value,
        });

        await organizationManager.value.patch(Organization.patch({
            id: organization.id,
            meta: metaPatch,
        }));

        await props.saveHandler(navigationActions);
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        saving.value = false;
    }
}
</script>
