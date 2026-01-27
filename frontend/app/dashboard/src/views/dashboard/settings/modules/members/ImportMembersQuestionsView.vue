<template>
    <SaveView :title="$t('c67f13a2-08cb-4c30-a39d-d07679430672')" :loading="saving" :save-text="`Importeer ${importMemberResults.length} leden`" @save="goNext">
        <h1>{{ saving ? $t('1153ea0d-ec79-4677-aea9-d2f293cdfe57') : $t('4c795a2e-9675-4151-8cba-6222ed2ec3b5') }}</h1>
        <p v-if="!saving">
            {{ $t('122da7ee-3e58-416c-a0b7-ee84fbd39a2e') }}
        </p>
        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="!saving">
            <p v-if="existingCount > 0 && existingCount === importMemberResults.length" class="warning-box">
                {{ $t('56e63fc2-5364-40db-bc51-f4446725bfd9') }} <template v-if="membersWithNewRegistrations.length">
                    {{ $t('ca9fbe8b-0857-4b86-ba53-77b5bb14ee5d') }}
                </template>{{ $t('20dd247f-c26d-4fc2-b6a6-de345d5a270b') }}
            </p>
            <p v-else-if="existingCount > 0" class="warning-box">
                {{ $t('be7ebd45-bb3e-49bd-a4b0-6cf32d2977b8', {
                    existingCount,
                    memberTranslation: existingCount == 1 ? $t('bd4f2ee1-ffd5-4f8b-97d5-49627c55e147') : $t('ad919b4f-2896-4a75-ab97-3916cf6e7796'),
                    total: importMemberResults.length
                }) }}
            </p>

            <p v-if="deletedRegistrationsCount > 0" class="warning-box">
                {{ $t('b7838e09-f22e-441d-a36b-9e78599ca2e9', {count: deletedRegistrationsCount}) }}
            </p>
            <p v-if="membersWithoutNewRegistrations.length" class="success-box">
                {{ $t('abd71533-048e-45c7-baf8-78769e5287de', {count: membersWithoutNewRegistrations.length}) }}
            </p>

            <template v-if="membersWithNewRegistrations.length">
                <hr>
                <h2>{{ $t('40b335d7-93c8-48a9-90ec-bb088b6e59e9') }}</h2>

                <STInputBox v-if="hasWaitingLists" error-fields="waitingList" :error-box="errors.errorBox" class="max" :title="$t(`063a8e6f-8639-4089-87a6-f58da1dfda17`)">
                    <RadioGroup>
                        <Radio v-model="isWaitingList" :value="false">
                            {{ $t('08dd4181-69c6-4888-b32a-07224f1c4349') }}
                        </Radio>
                        <Radio v-model="isWaitingList" :value="true">
                            {{ $t('22f85f39-c9bc-4134-beca-bd08518c3fbc') }}
                        </Radio>
                    </RadioGroup>
                </STInputBox>

                <p v-if="waitingListWarning" class="warning-box">
                    {{ waitingListWarning }}
                </p>

                <template v-if="!isWaitingList">
                    <STInputBox v-if="needsPaidStatus" :title="$t(`80728515-caad-488b-a3d6-0f634b908766`)" error-fields="paid" :error-box="errors.errorBox" class="max">
                        <RadioGroup>
                            <Radio v-model="paid" :value="true">
                                {{ $t('816a862c-c87c-4ab8-9d88-bc847bf364e4') }}
                            </Radio>
                            <Radio v-model="paid" :value="false">
                                {{ $t('14806378-4cc0-4b16-bd94-82bec5a9572d') }}
                            </Radio>
                            <Radio v-model="paid" :value="null">
                                {{ $t('fa61e548-6b55-4a19-884f-01bca675064c') }}
                            </Radio>
                        </RadioGroup>
                    </STInputBox>
                    <p v-if="!needsPaidStatus && somePaid" class="success-box">
                        {{ $t('03518587-e43b-4ec4-9cf8-8e2c30037252') }}
                    </p>

                    <p v-if="needsPaidStatus && somePaid" class="warning-box">
                        {{ $t('5f451950-7d73-4a4e-a2c7-3155e6611a26') }}
                    </p>

                    <p v-if="needsPaidStatus && paid === null" class="warning-box">
                        {{ $t("6efbbc87-a346-49cd-bf60-0323befdc468") }}
                    </p>
                </template>
            </template>

            <template v-if="needsGroupAssignment">
                <hr>
                <h2>{{ $t('e47b2390-af43-40a0-a7e3-5cd98b247c40') }}</h2>

                <p class="warning-box">
                    {{ membersNeedingAssignment.length }} {{ $t('4e90f074-fbc4-40d3-aca6-db901e15cbc9') }}
                </p>

                <STInputBox error-fields="group" :error-box="errors.errorBox" class="max" :title="$t(`898c44be-3635-4509-920a-956a9c0a332c`)">
                    <RadioGroup>
                        <Radio v-model="autoAssign" :value="true">
                            {{ $t('69bc8583-a0ea-4396-9e65-ce69840e80ea') }}
                        </Radio>
                        <Radio v-model="autoAssign" :value="false">
                            {{ $t('acc349b9-d5d5-479d-81c0-e06fe0badafd') }}
                        </Radio>
                    </RadioGroup>

                    <template #right>
                        <button class="button text" type="button" @click.stop="openAssignment">
                            <span class="icon help" />
                            <span>{{ $t('be6836a1-b867-48df-9b2e-5372e5c1cdd6') }}</span>
                        </button>
                    </template>
                </STInputBox>

                <template v-if="autoAssign">
                    <STInputBox v-if="membersWithMultipleGroups.length > 0" error-fields="group" :error-box="errors.errorBox" class="max" :title="$t(`8685578a-1994-4435-ac7f-d6aabb01ffa4`)">
                        <p class="info-box">
                            {{ $t('175681a6-9e67-4b72-9295-df864d6d4032', {
                                count: membersWithMultipleGroups.length,
                                memberTranslation: membersWithMultipleGroups.length == 1 ? $t('7edb3d38-4eaf-4314-867e-9621b5fb826e') : $t('23884766-9223-4d27-a5d9-ad5e85066cd9')
                            }) }}
                        </p>

                        <STList v-model="draggableGroups" :draggable="true">
                            <template #item="{item: group, index}">
                                <STListItem class="right-description">
                                    {{ index + 1 }}. {{ group.settings.name }}

                                    <template #right>
                                        <span>{{ getGroupAutoAssignCountForPriority(group) }}</span>
                                        <button class="button icon external" type="button" @click="openPriorityAssignedToGroup(group)" />
                                        <span class="button icon drag gray" @click.stop @contextmenu.stop />
                                    </template>
                                </STListItem>
                            </template>
                        </STList>

                        <template #right>
                            <button type="button" class="button text" @click.stop="openMultipleGroups">
                                <span class="icon help" />
                                <span>{{ $t('72d6dd0c-ff03-402c-8efc-a29fb7dbf12f') }}</span>
                            </button>
                        </template>
                    </STInputBox>

                    <STInputBox v-if="membersWithoutMatchingGroups.length > 0" error-fields="group" :error-box="errors.errorBox" class="max" :title="$t(`d6b5d4d9-533f-444c-8cfb-154efcd6b63b`)">
                        <p class="info-box">
                            {{ $t('0b31be9d-7681-44a4-8389-f5212167541e', {count: membersWithoutMatchingGroups.length}) }}
                        </p>

                        <Dropdown v-model="defaultGroup">
                            <option v-for="group in groups" :key="group.id" :value="group">
                                {{ group.settings.name }}
                            </option>
                        </Dropdown>

                        <template #right>
                            <button type="button" class="button text" @click.stop="openWithoutMatchingGroups">
                                <span class="icon help" />
                                <span>{{ $t('72d6dd0c-ff03-402c-8efc-a29fb7dbf12f') }}</span>
                            </button>
                        </template>
                    </STInputBox>
                </template>
                <template v-else>
                    <STInputBox error-fields="group" :error-box="errors.errorBox" class="max" :title="$t(`96acfe84-33fa-4fa2-b31a-098108100ffb`)">
                        <Dropdown v-model="defaultGroup">
                            <option v-for="group in groups" :key="group.id" :value="group">
                                {{ group.settings.name }}
                            </option>
                        </Dropdown>
                    </STInputBox>
                </template>
            </template>

            <hr>

            <STList>
                <STListItem :selectable="true" @click.prevent="openResultView">
                    <template #left>
                        <span class="icon eye" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('394a37e4-8b91-433b-9808-d1b482ffc07f') }}
                    </h3>
                </STListItem>
            </STList>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { Dropdown, Radio, RadioGroup, STErrorsDefault, STInputBox, STList, STListItem, Toast, useContext, useErrors, useNavigationActions, usePlatform, usePlatformFamilyManager, useRequiredOrganization } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { getGenderName, Group, GroupType, OrganizationRegistrationPeriod, Parent, ParentTypeHelper, Registration } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, Ref, ref, watch } from 'vue';
import { ImportMemberResult } from '../../../../../classes/import/ImportMemberResult';
import ImportAutoAssignedView from './ImportAutoAssignedView.vue';
import ImportMembersErrorReportView from './ImportMembersErrorReportView.vue';
import { MemberImporter } from './MemberImporter';

const props = defineProps<{
    period: OrganizationRegistrationPeriod;
    importMemberResults: ImportMemberResult[];
}>();

const present = usePresent();
const errors = useErrors();
const platform = usePlatform();
const platformFamilyManager = usePlatformFamilyManager();
const navigate = useNavigationActions();
const organization = useRequiredOrganization();
const saving = ref(false);
const paid = ref<boolean | null>(null);
const isWaitingList = ref(false);
const autoAssign = ref(true);
const groups = props.period.groups;
const defaultGroup = ref(groups[0]) as unknown as Ref<Group>;
const multipleGroups = ref(calculateMultipleGroups(groups)) as unknown as Ref<Group[]>;
const owner = useRequestOwner();
const context = useContext();
const show = useShow();
const pop = usePop();

const memberImporter = new MemberImporter({
    platform: platform.value,
    organization: organization.value,
    period: props.period,
    platformFamilyManager: platformFamilyManager,
    context: context.value,
    requestOwner: owner,
});

watch([autoAssign, defaultGroup], () => {
    autoAssignMembers(props.importMemberResults);
});

const needsPaidStatus = computed(() => {
    return !!membersWithNewRegistrations.value.find(m => m.importRegistrationResult.paid === null && m.importRegistrationResult.paidPrice === null);
});

const somePaid = computed(() => {
    return !!membersWithNewRegistrations.value.find(m => m.importRegistrationResult.paid !== null || m.importRegistrationResult.paidPrice !== null);
});

const needsGroupAssignment = computed(() => membersNeedingAssignment.value.length > 0);
const existingCount = computed(() => props.importMemberResults.filter(m => m.isExisting).length);
const hasWaitingLists = !!groups.find(g => g.waitingList !== null);

const membersNeedingAssignment = computed(() => {
    return props.importMemberResults.filter((m) => {
        return shouldAssignRegistrationToMember(m);
    });
});

const waitingListWarning = computed(() => {
    if (!isWaitingList.value) {
        return null;
    }

    const groupMap = new Map<string, Group>();

    for (const member of props.importMemberResults) {
        const registrationData = memberImporter.buildRegistration(member, isWaitingList.value);

        if (registrationData && registrationData.group.type !== GroupType.WaitingList) {
            if (groupMap.has(registrationData.group.id)) {
                continue;
            }
            groupMap.set(registrationData.group.id, registrationData.group);
        }
    }

    if (!groupMap.size) {
        return null;
    }

    return $t('aaca8552-d08b-45d4-a068-3e441ceb1142', { groups: Formatter.joinLast(Array.from(groupMap.values()).map(g => g.settings.name.toString()), ', ', ' ' + $t('en') + ' ') });
});

const membersWithNewRegistrations = computed(() => props.importMemberResults.filter(m => memberImporter.hasNewRegistration(m, isWaitingList.value)));

const membersWithoutNewRegistrations = computed(() => props.importMemberResults.filter(m => !memberImporter.hasNewRegistration(m, isWaitingList.value)));

const deletedRegistrationsCount = computed(() => {
    return membersWithNewRegistrations.value.reduce((acc, m) => {
        const registration = memberImporter.buildRegistration(m, isWaitingList.value);
        if (!registration) {
            return acc;
        }
        return acc + memberImporter.getOverrideRegistrations(registration, m).length;
    }, 0);
});

function isValidRegistration(registration: Registration) {
    return registration.deactivatedAt === null && registration.registeredAt !== null;
}

function shouldAssignRegistrationToMember(m: ImportMemberResult) {
    if (m.importRegistrationResult.group !== null) {
        return false;
    }

    const activeRegistrations = m.existingMember?.member.registrations.filter(r => isValidRegistration(r)) ?? [];
    const waitingGroups = m.existingMember?.member.registrations.filter(r => isValidRegistration(r) && r.group.type === GroupType.WaitingList) ?? [];

    if (activeRegistrations.length > 0 && !isWaitingList.value) {
        return false;
    }

    if (waitingGroups.length > 0 && isWaitingList.value) {
        return false;
    }

    return true;
}

const membersWithMultipleGroups = computed(() => {
    return membersNeedingAssignment.value.filter((m) => {
        const matchedGroups = m.patchedDetails.getMatchingGroups(groups);
        return (matchedGroups.length > 1);
    });
});

const membersWithoutMatchingGroups = computed(() => {
    return membersNeedingAssignment.value.filter((m) => {
        const matchedGroups = m.patchedDetails.getMatchingGroups(groups);
        return (matchedGroups.length === 0);
    });
});

/**
 * Groups for which we need to set a priority, because some members fit in more than one of them
 */
function calculateMultipleGroups(groups: Group[]) {
    const filteredGroups = groups.filter(g => g.type === GroupType.Membership);
    const multipleGroups = new Map<string, Group>();

    for (const member of props.importMemberResults) {
        if (member.importRegistrationResult.group !== null) {
            continue;
        }
        const g = member.patchedDetails.getMatchingGroups(filteredGroups);
        if (g.length > 1) {
            for (const gg of g) {
                multipleGroups.set(gg.id, gg);
            }
        }
    }
    return [...multipleGroups.values()].sort((a, b) => -Sorter.stack(Sorter.byNumberValue(a.settings.maxAge ?? 9, b.settings.maxAge ?? 99), Sorter.byNumberValue(a.settings.minAge ?? 0, b.settings.minAge ?? 0)));
}

/**
 * Map these members to their corresponding group (id), using priority, default etc
 */
function autoAssignMembers(members: ImportMemberResult[]) {
    for (const member of members) {
        if (!shouldAssignRegistrationToMember(member)) {
            member.importRegistrationResult.autoAssignedGroup = null;
            continue;
        }

        if (!autoAssign.value) {
            member.importRegistrationResult.autoAssignedGroup = defaultGroup.value;
            continue;
        }

        const g = member.patchedDetails.getMatchingGroups(groups);
        if (g.length === 0) {
            member.importRegistrationResult.autoAssignedGroup = defaultGroup.value;
        }
        else if (g.length === 1) {
            member.importRegistrationResult.autoAssignedGroup = g[0];
        }
        else {
            // Get group that is first in the priority queue (= multipleGroups)
            member.importRegistrationResult.autoAssignedGroup = multipleGroups.value.find((group) => {
                return (g.includes(group));
            }) ?? defaultGroup.value;
        }
    }
}

function getGroupAutoAssignCountForPriority(group: Group) {
    autoAssignMembers(membersWithMultipleGroups.value);
    return membersWithMultipleGroups.value.reduce((current, member) => {
        if (member.importRegistrationResult.autoAssignedGroup && member.importRegistrationResult.autoAssignedGroup.id === group.id) {
            return current + 1;
        }
        return current;
    }, 0);
}

function openAssignment() {
    autoAssignMembers(props.importMemberResults);
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: $t(`3a70601b-aa96-4c63-bd47-8d9927483433`),
        description: $t(`7eb4f64b-68be-4cb4-8fcb-255093af9037`),
        members: membersNeedingAssignment.value.flatMap((m) => {
            if (m.importRegistrationResult.autoAssignedGroup === null) {
                return [];
            }

            return [{
                name: m.patchedDetails.name,
                description: m.importRegistrationResult.autoAssignedGroup.settings.name,
            }];
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

function openPriorityAssignedToGroup(group: Group) {
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: $t(`a45744c8-fa0e-4300-bd1a-502321266aca`, { group: group.settings.name }),
        description: $t(`a28ab93c-ac3a-4422-bcaf-170d28161604`, { group: group.settings.name }),
        members: membersWithMultipleGroups.value.flatMap((m) => {
            if (m.importRegistrationResult.group !== null) {
                return [];
            }

            if (m.importRegistrationResult.autoAssignedGroup?.id === group.id) {
                const matchingGroups = m.patchedDetails.getMatchingGroups(groups);
                return [{
                    name: m.patchedDetails.name,
                    description: matchingGroups.map(g => g.settings.name).join(', '),
                }];
            }

            return [];
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

function openMultipleGroups() {
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: $t(`0b5df66c-39eb-45b9-bc54-5013752bd8f1`),
        description: $t(`85c892af-972f-4a52-8769-4452ebbcdf8d`),
        members: membersWithMultipleGroups.value.flatMap((m) => {
            if (m.importRegistrationResult.group !== null) {
                return [];
            }

            const matchingGroups = m.patchedDetails.getMatchingGroups(groups);
            return [{
                name: m.patchedDetails.name,
                description: matchingGroups.map(g => g.settings.name).join(', '),
            }];
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

function getParentDescription(parent: Parent) {
    const description: string[] = [];
    let type = ParentTypeHelper.getName(parent.type);
    if (parent.name.trim()) {
        description.push(type + ': ' + parent.name);
    }
    if (parent.phone) {
        description.push(type + ' ' + $t(`f956eedf-ca2e-4d8c-925d-434bf3adfd24`) + ': ' + parent.phone);
    }
    if (parent.email) {
        description.push(type + ' ' + $t(`9755e27e-7128-4682-af6e-e3a2a5d95a42`) + ': ' + parent.email);
    }
    if (parent.address) {
        description.push(type + ' ' + $t(`38f3e042-b8a7-4bba-bf2a-d7c391f23268`) + ': ' + parent.address.toString());
    }
    if (parent.nationalRegisterNumber) {
        description.push(type + ' ' + $t(`cd5d00db-1fcc-4079-bbe3-36dc001e93d4`) + ': ' + parent.nationalRegisterNumber.toString());
    }
    return description;
}

function openResultView() {
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: $t(`85a193ca-cd6a-498d-957d-c627cc2b27f5`),
        description: $t(`cc4f9269-8e85-4b69-809e-cc466bdfe9cd`),
        members: props.importMemberResults.map((member) => {
            let description: string[] = [];
            const registration = memberImporter.buildRegistration(member, isWaitingList.value);

            if (registration !== null) {
                const group = groups.find(g => g.id === registration.group.id);
                const groupName = (group?.settings.name ?? $t(`b979d1ed-d909-4c9f-9235-669be553af2b`));

                let suffix = '';

                if (member.importRegistrationResult.paidPrice !== null) {
                    suffix = ` (${$t('b53eb56b-1380-4bc5-bc07-9e813c435e69', { price: Formatter.price(member.importRegistrationResult.paidPrice) })})`;
                }
                else if (member.importRegistrationResult.paid || paid.value) {
                    suffix = ` (${$t('a56aa092-fd87-40b9-9a8c-7822796e6927')})`;
                }
                else {
                    suffix = ` (${$t('d6c8c3d5-a969-4b2f-ade9-dfc797e98772')})`;
                }

                if (member.existingMember) {
                    if (registration !== null) {
                        if (registration.group.type === GroupType.WaitingList) {
                            description.push($t(`70c70815-5095-4eb7-9eb2-f93cb1660135`, { group: groupName }) + suffix);
                        }
                        else {
                            description.push($t(`6258cf03-8bad-4ed3-869b-5771bcd797f6`, { group: groupName }) + suffix);
                        }

                        // Delete conflicting registrations (based on categories too!)
                        const deleteRegs = memberImporter.getOverrideRegistrations(registration, member);
                        for (const r of deleteRegs) {
                            const groupName = (groups.find(g => g.id === r.groupId)?.settings.name ?? $t(`b979d1ed-d909-4c9f-9235-669be553af2b`));
                            if (r.group.type === GroupType.WaitingList) {
                                description.push($t(`237dcb63-7ff6-4bb2-83c5-b3e961c6e1f1`, { group: groupName }));
                            }
                            else {
                                description.push($t(`fc2d09ad-9c8d-4867-95f4-2ef7e82c655c`, { group: groupName }));
                            }
                        }
                    }
                }
                else {
                    if (registration.group.type === GroupType.WaitingList) {
                        description.push($t(`29e73b62-658a-4203-8c05-c4a39f4dc01d`, { group: groupName }) + suffix);
                    }
                    else {
                        description.push($t(`c3031fda-2cfb-46b7-8cb6-b31ad49034e8`, { group: groupName }) + suffix);
                    }
                }
            }
            else if (member.isExisting) {
                description.push($t(`fd679ae9-a363-40cf-86c0-1434f6fd9b7f`));
            }

            if (member.existingMember) {
                const existingDetails = member.existingMember.member.details;
                const patched = member.patchedDetails;

                if (patched.name !== undefined && existingDetails.name !== patched.name) {
                    description.push($t(`d95eeb45-400f-4e6f-8e18-6fd174b9eecb`, { name: patched.name }));
                }
                if (patched.nationalRegisterNumber && patched.nationalRegisterNumber !== existingDetails.nationalRegisterNumber) {
                    description.push($t(`80e82f78-0e15-4e6a-82c0-d4ee613683f8`, { nationalRegisterNumber: patched.nationalRegisterNumber.toString() }));
                }
                if (patched.gender !== undefined && existingDetails.gender !== patched.gender) {
                    description.push($t(`a68feeef-07a3-4406-86ef-e5ab1a168513`, { gender: getGenderName(patched.gender) }));
                }
                if (patched.email !== undefined && patched.email && existingDetails.email !== patched.email) {
                    description.push($t(`d63b416e-cb04-46d3-ad4c-a2837b9c7b3b`, { email: patched.email }));
                }
                if (patched.phone !== undefined && patched.phone && existingDetails.phone !== patched.phone) {
                    description.push($t(`c8c3af57-4b8b-4283-9279-3e5f1de35bde`, { phone: patched.phone }));
                }
                if (patched.birthDay && (!existingDetails.birthDay || (Formatter.dateIso(existingDetails.birthDay) !== Formatter.dateIso(patched.birthDay)))) {
                    description.push($t(`f674fdec-5cb4-421a-b53d-1a3f43c65649`, { birthDay: Formatter.date(patched.birthDay, true) }));
                }

                if (patched.address && patched.address.toString() !== existingDetails.address?.toString()) {
                    description.push($t(`5f314eb9-f2f2-4048-aad8-3f16e9bb7ad1`, { address: patched.address.toString() }));
                }

                if (patched.memberNumber && patched.memberNumber !== existingDetails.memberNumber) {
                    description.push($t(`083a34cb-26f4-4467-978e-3dc19897befb`, { memberNumber: patched.memberNumber }));
                }

                if (patched.uitpasNumberDetails && patched.uitpasNumberDetails.uitpasNumber !== existingDetails.uitpasNumberDetails?.uitpasNumber) {
                    description.push($t(`e08cef03-c352-41cd-8e7b-3ef632b69ee4`, { number: patched.uitpasNumberDetails.uitpasNumber }));
                }

                for (const parent of member.getChangedParents()) {
                    description.push(...getParentDescription(parent));
                }

                for (const answer of member.getChangedRecordAnswers()) {
                    description.push($t('9d96814a-e44a-4f9f-b98b-d36838963c39', { key: answer.settings.name, value: answer.stringValue }));
                }
            }
            else {
                const patched = member.patchedDetails;

                if (patched.name) {
                    description.push($t(`1afb49be-fbdc-4388-9b5a-50a1c7f67b82`) + ': ' + patched.name);
                }
                if (patched.nationalRegisterNumber) {
                    description.push($t(`ff818d9d-658a-42cd-924e-75fc839aa9ea`) + ': ' + patched.nationalRegisterNumber.toString());
                }
                if (patched.gender) {
                    description.push($t(`08ef39ff-3431-4975-8c46-8fb68c946432`) + ': ' + getGenderName(patched.gender));
                }
                if (patched.email) {
                    description.push($t(`4f483ae0-74b5-4b48-94c0-d4c4f807009a`) + ': ' + patched.email);
                }
                if (patched.phone) {
                    description.push($t(`e8cc0b81-c481-4c74-bac0-2e110685cd20`) + ': ' + patched.phone);
                }
                if (patched.birthDay) {
                    description.push($t(`50e0222d-8de4-43c4-8489-7879c2f681af`) + ': ' + Formatter.date(patched.birthDay, true));
                }

                if (patched.address) {
                    description.push($t(`e98ef894-3461-4c12-b38a-80f8c62db915`) + ': ' + patched.address.toString());
                }

                if (patched.memberNumber) {
                    description.push($t(`123be534-a0be-4a6e-b03f-021659e1d8ba`) + ': ' + patched.memberNumber);
                }

                if (patched.uitpasNumberDetails) {
                    description.push($t(`e330f60b-d331-49a2-a437-cddc31a878de`) + ': ' + patched.uitpasNumberDetails.uitpasNumber);
                }

                for (const parent of patched.parents) {
                    description.push(...getParentDescription(parent));
                }

                for (const answer of patched.recordAnswers.values()) {
                    description.push($t('9d96814a-e44a-4f9f-b98b-d36838963c39', { key: answer.settings.name, value: answer.stringValue }));
                }
            }

            return {
                name: member.patchedDetails.name,
                description: description.join('\n'),
            };
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

const draggableGroups = computed({
    get: () => multipleGroups.value,
    set: (groups) => {
        if (groups.length !== multipleGroups.value.length) {
            return;
        }

        multipleGroups.value = groups;
    },
});

function openWithoutMatchingGroups() {
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: $t(`4c531fed-ac16-4b22-9ff1-975875934d13`),
        description: $t(`9a1ec903-87bd-4776-9436-007caf94bcf3`),
        members: membersWithoutMatchingGroups.value.flatMap((m) => {
            return [{
                name: m.patchedDetails.name,
                group: '/',
            }];
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

async function goNext() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    const toast = new Toast($t(`06543b84-87c5-416b-8880-6ad24c91b478`), 'spinner').setHide(null).show();

    try {
        autoAssignMembers(props.importMemberResults);
        const reports = await memberImporter.importResults(props.importMemberResults, {
            isWaitingList: isWaitingList.value,
            paid: paid.value,
        }, progress => toast.setProgress(progress));

        toast.hide();

        if (reports.some(r => r.hasError)) {
            show(new ComponentWithProperties(ImportMembersErrorReportView, {
                reports,
                onNext: () => {
                    pop()?.catch(console.error);
                },
            })).catch(console.error);
        }
        else {
            new Toast($t(`49c9b8ee-ab37-45e7-84e1-ef11d78fb9ac`), 'success green').show();
            navigate.dismiss({ force: true }).catch(console.error);
        }
    }
    catch (e) {
        toast.hide();
        console.error(e);
        Toast.fromError(e).show();
    }
    saving.value = false;
}
</script>
