<template>
    <SaveView :title="title" :loading="loading" :save-text="saveText" :disabled="!selectedOrganization" @save="save">
        <h1>{{ title }}</h1>

        <p v-if="availableOrganizations.length === 0" class="warning-box">
            {{ $t('ec0c482e-0528-499f-82fa-b081bf708ded') }}
        </p>
        <template v-else>
            <ScrollableSegmentedControl v-if="availableOrganizations.length > 1" v-model="selectedOrganization" :items="availableOrganizations" :labels="availableOrganizations.map(o => o.name)" />

            <p v-if="organization" class="style-description-block">
                {{ $t('7c2fee1a-0838-4346-848d-a3d984e70fdc') }}
            </p>
            <p v-else class="style-description-block">
                {{ $t('525747e4-48df-4f20-979e-3c18142e64a5', {name: selectedOrganization.name }) }}
            </p>

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
                        <STInputBox :title="$t('3d3a30bb-3628-413e-8d1a-3864b1dae8e1')" :error-box="errors.errorBox" error-fields="startDate">
                            <DateSelection v-model="customStartDate" class="option" :min="minimumStartDateForDaysTypes" />
                        </STInputBox>

                        <STInputBox :title="$t('f3cc0597-fe12-4cb1-bd41-4c7ce5d59235')" :error-box="errors.errorBox" error-fields="endDate">
                            <DateSelection v-model="customEndDate" class="option" :min="minimumStartDateForDaysTypes" />
                        </STInputBox>
                    </div>
                    <div v-else-if="selectedMembershipType.id === type.id">
                        <STInputBox :title="$t('3d3a30bb-3628-413e-8d1a-3864b1dae8e1')" :error-box="errors.errorBox" error-fields="startDate">
                            <DateSelection
                                v-model="customStartDate"
                                class="option"
                                :min="selectedMembershipType.periods.get(period.id)?.startDate ?? null"
                                :max="selectedMembershipType.periods.get(period.id)?.endDate ?? null"
                            />
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
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ScrollableSegmentedControl, STErrorsDefault, Toast, usePlatformFamilyManager } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { MemberPlatformMembership, MemberWithRegistrationsBlob, PlatformMember, PlatformMembershipType, PlatformMembershipTypeBehaviour, RegistrationPeriod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { ErrorBox } from '../../../errors/ErrorBox';
import { useErrors } from '../../../errors/useErrors';
import { useOrganization, usePlatform } from '../../../hooks';
import DateSelection from '../../../inputs/DateSelection.vue';

const props = defineProps<{
    member: PlatformMember;
    period: RegistrationPeriod;
}>();

const $t = useTranslate();
const title = $t('cb85826e-06fc-473c-95c2-ba338fdbab50');
const loading = ref(false);
const saveText = 'Toevoegen';
const organization = useOrganization();
const platform = usePlatform();
const now = new Date();

const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const customStartDate = ref(today);
const customEndDate = ref(today);
const minimumStartDateForDaysTypes = today;

if (customStartDate.value < props.period.startDate) {
    customStartDate.value = props.period.startDate;
}
if (customEndDate.value > props.period.endDate) {
    customEndDate.value = props.period.endDate;
}

const errors = useErrors();
const platformFamilyManager = usePlatformFamilyManager();
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
        const periodConfig = selectedMembershipType.value.periods.get(props.period.id);
        if (!periodConfig) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Dit aansluitingstype is (nog) niet beschikbaar voor dit werkjaar',
            });
        }

        const errors = new SimpleErrors();

        if (selectedMembershipType.value.behaviour === PlatformMembershipTypeBehaviour.Days) {
            if (customStartDate.value < today) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'startDate',
                    message: 'De startdatum kan ten vroegste morgen zijn',
                }));
            }

            if (customStartDate.value.getTime() > customEndDate.value.getTime()) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'endDate',
                    message: 'De einddatum moet na de startdatum liggen',
                }));
            }

            if (customStartDate.value < periodConfig.startDate) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'startDate',
                    message: 'De startdatum kan niet voor ' + Formatter.date(periodConfig.startDate) + ' liggen',
                }));
            }

            if (customStartDate.value > periodConfig.endDate) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'startDate',
                    message: 'De startdatum kan niet na ' + Formatter.date(periodConfig.endDate) + ' liggen',
                }));
            }

            if (customEndDate.value > periodConfig.endDate) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'endDate',
                    message: 'De einddatum kan niet na ' + Formatter.date(periodConfig.endDate) + ' liggen',
                }));
            }
        }

        if (selectedMembershipType.value.behaviour === PlatformMembershipTypeBehaviour.Period) {
            if (customStartDate.value < periodConfig.startDate) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'startDate',
                    message: 'De startdatum kan niet voor ' + Formatter.date(periodConfig.startDate) + ' liggen',
                }));
            }

            if (customStartDate.value > periodConfig.endDate) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'startDate',
                    message: 'De startdatum kan niet na ' + Formatter.date(periodConfig.endDate) + ' liggen',
                }));
            }
        }

        errors.throwIfNotEmpty();

        // Execute an isolated patch
        const platformMembershipsPatch = new PatchableArray() as PatchableArrayAutoEncoder<MemberPlatformMembership>;
        platformMembershipsPatch.addPut(
            MemberPlatformMembership.create({
                memberId: props.member.member.id,
                membershipTypeId: selectedMembershipType.value.id,
                organizationId: selectedOrganization.value!.id,
                periodId: props.period.id,
                startDate: selectedMembershipType.value.behaviour === PlatformMembershipTypeBehaviour.Days ? customStartDate.value : periodConfig.startDate,
                endDate: selectedMembershipType.value.behaviour === PlatformMembershipTypeBehaviour.Days ? customEndDate.value : periodConfig.endDate,
                expireDate: selectedMembershipType.value.behaviour === PlatformMembershipTypeBehaviour.Days ? null : periodConfig.expireDate,
            }),
        );

        const patch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        patch.addPatch(MemberWithRegistrationsBlob.patch({
            id: props.member.member.id,
            platformMemberships: platformMembershipsPatch,
        }));

        await platformFamilyManager.isolatedPatch([props.member], patch, false);

        Toast.success('Aansluiting toegevoegd').show();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    loading.value = false;
}

function getTypeAvailable(type: PlatformMembershipType) {
    return type.periods.has(props.period.id);
}

function getTypeDateDescription(type: PlatformMembershipType) {
    const periodConfig = type.periods.get(props.period.id);
    if (!periodConfig) {
        return '';
    }

    if (type.behaviour === PlatformMembershipTypeBehaviour.Days) {
        return '';
    }

    return Formatter.date(periodConfig.startDate, true) + ' - ' + Formatter.date(periodConfig.expireDate ?? periodConfig.endDate, true);
}

function getTypePriceDescription(type: PlatformMembershipType) {
    return getPriceForDate(type, new Date());
}

function getTypePriceNormalPrice(type: PlatformMembershipType) {
    return getPriceForDate(type, new Date(1));
}

function getPriceForDate(type: PlatformMembershipType, date: Date) {
    const periodConfig = type.periods.get(props.period.id);
    if (!periodConfig) {
        return 'Niet beschikbaar';
    }

    const priceConfig = periodConfig.getPriceConfigForDate(date);

    if (type.behaviour === PlatformMembershipTypeBehaviour.Days) {
        return Formatter.price(priceConfig.pricePerDay) + ' per dag';
    }

    const tagIds = selectedOrganization.value?.meta.tags ?? [];
    const shouldApplyReducedPrice = props.member.shouldApplyReducedPrice;
    const price = priceConfig.getBasePrice(tagIds, shouldApplyReducedPrice);

    return Formatter.price(price);
}
</script>
