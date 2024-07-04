<template>
    <SaveView :title="title" :loading="loading" :save-text="saveText" @save="save">
        <h1>{{ title }}</h1>

        <ScrollableSegmentedControl v-if="availableOrganizations.length > 1" v-model="selectedOrganization" :items="availableOrganizations" :labels="availableOrganizations.map(o => o.name)" />
        
        <p class="style-description-block">{{ $t('dashboard.platformMemberhip.add.description') }}</p>        

        <STErrorsDefault :error-box="errors.errorBox" />
        
        <STList>
            <STListItem v-for="type of availableMembershipTypes" :key="type.id" :disabled="!getTypeAvailable(type)" :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="selectedMembershipType" :value="type" :disabled="!getTypeAvailable(type)" />
                </template>
                <h2 class="style-title-list">
                    {{ type.name }}
                </h2>
                <p v-if="getTypeDateDescription(type) " class="style-description-small">
                    {{ getTypeDateDescription(type) }}
                </p>

                <p class="style-description-small">
                    {{ type.description }}
                </p>

                <div v-if="selectedMembershipType.id === type.id && type.behaviour === PlatformMembershipTypeBehaviour.Days">
                    <STInputBox :title="$t('dashboard.platformMemberhip.add.startDate')" :error-box="errors.errorBox" error-fields="startDate">
                        <DateSelection v-model="customStartDate" class="option" />
                    </STInputBox>

                    <STInputBox :title="$t('dashboard.platformMemberhip.add.endDate')" :error-box="errors.errorBox" error-fields="endDate">
                        <DateSelection v-model="customEndDate" class="option" />
                    </STInputBox>
                </div>

                <template #right>
                    <span v-if="getTypePriceNormalPrice(type) === getTypePriceDescription(type)">{{ getTypePriceDescription(type) }}</span>
                    <template v-else>
                        <span class="style-discount-old-price">{{ getTypePriceNormalPrice(type) }}</span>
                        <span class="style-discount-price">{{ getTypePriceDescription(type) }}</span>
                    </template>
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ScrollableSegmentedControl, Toast, usePlatformFamilyManager } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { MemberPlatformMembership, MemberWithRegistrationsBlob, PlatformMember, PlatformMembershipType, PlatformMembershipTypeBehaviour } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { ErrorBox } from '../../../errors/ErrorBox';
import { useErrors } from '../../../errors/useErrors';
import { useOrganization, usePlatform } from '../../../hooks';
import DateSelection from '../../../inputs/DateSelection.vue';
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';

const props = defineProps<{
    member: PlatformMember
}>();

const $t = useTranslate();
const title = $t('dashboard.platformMemberhip.add.title');
const loading = ref(false);
const saveText = 'Toevoegen';
const organization = useOrganization();
const platform = usePlatform();
const now = new Date();
const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
const customStartDate = ref(tomorrow);
const customEndDate = ref(tomorrow);
const errors = useErrors();
const platformFamilyManager = usePlatformFamilyManager()
const pop = usePop();

const availableOrganizations = computed(() => organization.value ? [organization.value] : props.member.organizations);
const selectedOrganization = ref(availableOrganizations.value[0] ?? null);

const availableMembershipTypes = computed(() => {
    return platform.value.config.membershipTypes.filter(t => t.requiredTagIds === null || (selectedOrganization.value && t.requiredTagIds.find(id => selectedOrganization.value!.meta.tags.includes(id))));
});

const selectedMembershipType = ref(availableMembershipTypes.value[0] ?? null);


async function save() {
    if (!selectedMembershipType.value) {
        return;
    }

    if (loading.value) {
        return;
    }

    loading.value = true;

    errors.errorBox = null;

    try {
        const periodConfig = selectedMembershipType.value.periods.get(platform.value.period.id);
        if (!periodConfig) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Dit aansluitingstype is (nog) niet beschikbaar voor dit werkjaar'
            })
        }

        const errors = new SimpleErrors();

        if (selectedMembershipType.value.behaviour === PlatformMembershipTypeBehaviour.Days) {
            if (customStartDate.value < tomorrow) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'startDate',
                    message: 'De startdatum kan ten vroegste morgen zijn'
                }))
            }

            if (customStartDate.value.getTime() > customEndDate.value.getTime()) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'endDate',
                    message: 'De einddatum moet na de startdatum liggen'
                }))
            }

            if (customStartDate.value < periodConfig.startDate) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'startDate',
                    message: 'De startdatum kan niet voor ' +Formatter.date(periodConfig.startDate)+ ' liggen'
                }))
            }

            if (customStartDate.value > periodConfig.endDate) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'startDate',
                    message: 'De startdatum kan niet na ' +Formatter.date(periodConfig.endDate)+ ' liggen'
                }))
            }

            if (customEndDate.value > periodConfig.endDate) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'endDate',
                    message: 'De einddatum kan niet na ' +Formatter.date(periodConfig.endDate)+ ' liggen'
                }))
            }
        }

        errors.throwIfNotEmpty()

        // Execute an isolated patch
        const platformMembershipsPatch = new PatchableArray() as PatchableArrayAutoEncoder<MemberPlatformMembership>;
        platformMembershipsPatch.addPut(
            MemberPlatformMembership.create({
                memberId: props.member.member.id,
                membershipTypeId: selectedMembershipType.value.id,
                organizationId: selectedOrganization.value!.id,
                periodId: platform.value.period.id,
                startDate: selectedMembershipType.value.behaviour === PlatformMembershipTypeBehaviour.Days ? customStartDate.value : periodConfig.startDate,
                endDate: selectedMembershipType.value.behaviour === PlatformMembershipTypeBehaviour.Days ? customEndDate.value : periodConfig.endDate
            })
        );

        const patch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        patch.addPatch(MemberWithRegistrationsBlob.patch({
            id: props.member.member.id,
            platformMemberships: platformMembershipsPatch
        }))

        await platformFamilyManager.isolatedPatch([props.member], patch, false)

        Toast.success('Aansluiting toegevoegd').show();
        await pop({force: true})

    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    loading.value = false;
}

function getTypeAvailable(type: PlatformMembershipType) {
    return type.periods.has(platform.value.period.id);
}

function getTypeDateDescription(type: PlatformMembershipType) {
    const periodConfig = type.periods.get(platform.value.period.id);
    if (!periodConfig) {
        return '';
    }

    if (type.behaviour === PlatformMembershipTypeBehaviour.Days) {
        return ''
    }

    return Formatter.date(periodConfig.startDate, true) + ' - ' + Formatter.date(periodConfig.expireDate ?? periodConfig.endDate, true);

}

function getTypePriceDescription(type: PlatformMembershipType) {
    const periodConfig = type.periods.get(platform.value.period.id);
    if (!periodConfig) {
        return 'Niet beschikbaar';
    }

    const priceConfig = periodConfig.getPriceForDate(new Date());

    if (type.behaviour === PlatformMembershipTypeBehaviour.Days) {
        return Formatter.price(priceConfig.pricePerDay) + ' per dag'
    }

    return Formatter.price(priceConfig.price);
}

function getTypePriceNormalPrice(type: PlatformMembershipType) {
    const periodConfig = type.periods.get(platform.value.period.id);
    if (!periodConfig) {
        return 'Niet beschikbaar';
    }

    const priceConfig = periodConfig.getPriceForDate(new Date(1));

    if (type.behaviour === PlatformMembershipTypeBehaviour.Days) {
        return Formatter.price(priceConfig.pricePerDay) + ' per dag'
    }

    return Formatter.price(priceConfig.price);
}


</script>
