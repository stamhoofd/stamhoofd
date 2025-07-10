<template>
    <SaveView :title="$t('Leden importeren')" :loading="saving" :save-text="`Importeer ${importMemberResults.length} leden`" @save="goNext">
        <h1>{{ $t('Importeer instellingen') }}</h1>
        <p>{{ $t('We hebben nog wat aanvullende vragen over hoe we de leden moeten importeren.') }}</p>
        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="!saving">
            <p v-if="existingCount > 0 && existingCount === importMemberResults.length" class="warning-box">
                {{ $t('Alle leden uit jouw bestand zitten al in het systeem. Als je kolommen hebt met gegevensvelden gaan die de gegevens in Stamhoofd overschrijven.') }} <template v-if="membersWithNewRegistrations.length">
                    {{ $t('Er zullen ook nieuwe inschrijvingen bij deze bestaande leden worden toegevoegd.') }}
                </template>{{ $t('Let goed op, je kan dit niet ongedaan maken.') }}
            </p>
            <p v-else-if="existingCount > 0" class="warning-box">
                {{ $t('{existingCount} {memberTranslation} uit jouw bestand zitten al in het systeem ({total} in totaal). Je gaat informatie in Stamhoofd overschrijven met informatie uit jouw bestand voor deze leden. Let goed op, je kan dit niet ongedaan maken.', {
                    existingCount,
                    memberTranslation: existingCount == 1 ? $t('lid') : $t('leden'),
                    total: importMemberResults.length
                }) }}
            </p>

            <p v-if="deletedRegistrationsCount > 0" class="warning-box">
                {{ $t('Stamhoofd zal {count} inschrijvingen of wachtlijst inschrijvingen verplaatsen voor bestaande leden op basis van jouw bestand.', {count: deletedRegistrationsCount}) }}
            </p>
            <p v-if="membersWithoutNewRegistrations.length" class="success-box">
                {{ $t('{count} leden uit jouw lijst zijn al ingeschreven. Hun huidige inschrijving(en) zullen niet worden aangepast, ze zullen ook geen nieuwe inschrijvingen krijgen. Hun andere gegevens uit het bestand zullen wel in Stamhoofd worden overgenomen.', {count: membersWithoutNewRegistrations.length}) }}
            </p>

            <template v-if="membersWithNewRegistrations.length">
                <hr>
                <h2>{{ $t('Inschrijvingstatus') }}</h2>

                <STInputBox v-if="hasWaitingLists" error-fields="waitingList" :error-box="errors.errorBox" class="max" :title="$t(`Wil je deze leden op de wachtlijst zetten?`)">
                    <RadioGroup>
                        <Radio v-model="isWaitingList" :value="false">
                            {{ $t('Nee') }}
                        </Radio>
                        <Radio v-model="isWaitingList" :value="true">
                            {{ $t('Ja, zet op wachtlijst') }}
                        </Radio>
                    </RadioGroup>
                </STInputBox>

                <template v-if="!isWaitingList">
                    <STInputBox v-if="needsPaidStatus" :title="$t(`Hebben deze leden al betaald?`)" error-fields="paid" :error-box="errors.errorBox" class="max">
                        <RadioGroup>
                            <Radio v-model="paid" :value="true">
                                {{ $t('Al betaald') }}
                            </Radio>
                            <Radio v-model="paid" :value="false">
                                {{ $t('Niet betaald') }}
                            </Radio>
                            <Radio v-model="paid" :value="null">
                                {{ $t('Sommigen wel, anderen niet') }}
                            </Radio>
                        </RadioGroup>
                    </STInputBox>
                    <p v-if="!needsPaidStatus && somePaid" class="success-box">
                        {{ $t('De betaalstatus uit jouw Excel-bestand zal worden gebruikt om de inschrijvingen met het juiste bedrag aan te maken.') }}
                    </p>

                    <p v-if="needsPaidStatus && somePaid" class="warning-box">
                        {{ $t('Van sommige leden hebben we in het bestand wel al de nodige betaalinformatie gevonden, bij hen wordt die informatie gebruikt en het bovenstaande genegeerd.') }}
                    </p>

                    <p v-if="needsPaidStatus && paid === null" class="warning-box">
                        {{ $t("We zetten de betaalstatus van alle leden op 'niet betaald'. Jij moet achteraf dan aanduiden wie al betaald heeft. Als je dat niet wilt doen, kan je de betaalstatus opnemen in jouw bestand door een extra kolom 'Betaald' toe te voegen en daar ja/nee in te zetten.") }}
                    </p>
                </template>
            </template>

            <template v-if="needsGroupAssignment">
                <hr>
                <h2>{{ $t('Inschrijvingsgroep') }}</h2>

                <p class="warning-box">
                    {{ membersNeedingAssignment.length }} {{ $t('leden uit jouw lijst hebben geen inschrijvingsgroep toegewezen gekregen (in een kolom). Kies hieronder hoe je deze wilt inschrijven in de juiste groep, of voeg een kolom in jouw bestand toe met de groep waar je elk lid wilt inschrijven.') }}
                </p>

                <STInputBox error-fields="group" :error-box="errors.errorBox" class="max" :title="$t(`Leeftijdsgroep toewijzen`)">
                    <RadioGroup>
                        <Radio v-model="autoAssign" :value="true">
                            {{ $t('Automatisch groep bepalen') }}
                        </Radio>
                        <Radio v-model="autoAssign" :value="false">
                            {{ $t('Allemaal in één groep inschrijven') }}
                        </Radio>
                    </RadioGroup>

                    <template #right>
                        <button class="button text" type="button" @click.stop="openAssignment">
                            <span class="icon help" />
                            <span>{{ $t('Toon resultaat') }}</span>
                        </button>
                    </template>
                </STInputBox>

                <template v-if="autoAssign">
                    <STInputBox v-if="membersWithMultipleGroups.length > 0" error-fields="group" :error-box="errors.errorBox" class="max" :title="$t(`Prioriteit van groepen`)">
                        <p class="info-box">
                            {{ $t('{count} {memberTranslation} in meer dan één groep. Je kan hieronder een prioriteit instellen. Dan schrijven we elk lid in bij één van groepen waar hij in past die de hoogste prioriteit heeft. Als je wilt kan je de leeftijd of geslacht van elke leeftijdsgroep (tijdelijk) beperken om op die manier automatisch de juiste leeftijdsgroep te kiezen (dat doe je bij instellingen > inschrijvingsgroepen)', {
                                count: membersWithMultipleGroups.length,
                                memberTranslation: membersWithMultipleGroups.length == 1 ? $t('lid past') : $t('leden passen')
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
                                <span>{{ $t('Toon leden') }}</span>
                            </button>
                        </template>
                    </STInputBox>

                    <STInputBox v-if="membersWithoutMatchingGroups.length > 0" error-fields="group" :error-box="errors.errorBox" class="max" :title="$t(`In welke groep wil je leden inschrijven die nergens in passen?`)">
                        <p class="info-box">
                            {{ $t('{count} leden passen in geen enkele groep. Kies hieronder in welke groep je deze toch wilt inschrijven.', {count: membersWithoutMatchingGroups.length}) }}
                        </p>

                        <Dropdown v-model="defaultGroup">
                            <option v-for="group in groups" :key="group.id" :value="group">
                                {{ group.settings.name }}
                            </option>
                        </Dropdown>

                        <template #right>
                            <button type="button" class="button text" @click.stop="openWithoutMatchingGroups">
                                <span class="icon help" />
                                <span>{{ $t('Toon leden') }}</span>
                            </button>
                        </template>
                    </STInputBox>
                </template>
                <template v-else>
                    <STInputBox error-fields="group" :error-box="errors.errorBox" class="max" :title="$t(`In welke groep wil je deze leden inschrijven?`)">
                        <Dropdown v-model="defaultGroup">
                            <option v-for="group in groups" :key="group.id" :value="group">
                                {{ group.settings.name }}
                            </option>
                        </Dropdown>
                    </STInputBox>
                </template>
            </template>
        </template>

        <hr>

        <STList>
            <STListItem :selectable="true" @click.prevent="openResultView">
                <template #left>
                    <span class="icon eye" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('Toon wijzigingen') }}
                </h3>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { Dropdown, Radio, RadioGroup, STErrorsDefault, STInputBox, STList, STListItem, Toast, useContext, useErrors, useNavigationActions, usePlatform, usePlatformFamilyManager, useRequiredOrganization } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { getGenderName, Group, GroupType, OrganizationRegistrationPeriod, Parent, ParentTypeHelper } from '@stamhoofd/structures';
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

function shouldAssignRegistrationToMember(m: ImportMemberResult) {
    if (m.importRegistrationResult.group !== null) {
        return false;
    }

    const activeRegistrations = m.existingMember?.member.registrations.filter(r => r.isActive) ?? [];
    const waitingGroups = m.existingMember?.member.registrations.filter(r => r.isActive && r.group.type === GroupType.WaitingList) ?? [];

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
        title: $t(`Wijzigingen aan inschrijvingen`),
        description: $t(`Hier zie je bij welke groep we elk lid gaan inschrijven, op basis van jouw instellingen en het bestand`),
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
        title: $t(`Leden die door prioriteit bij {group} zullen worden ingeschreven`, { group: group.settings.name }),
        description: $t(`Deze leden passen in meerdere groepen, maar op basis van jouw prioriteit bij {group} zullen worden ingeschreven`, { group: group.settings.name }),
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
        title: $t(`Leden die in meerdere groepen passen`),
        description: $t(`Dit zijn alle leden en de groepen waar ze in passen. Je kan beperken tot welke groepen ze horen door de instellingen van die groep te wijzigen.`),
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
        description.push(type + ' ' + $t(`telefoonnummer`) + ': ' + parent.phone);
    }
    if (parent.email) {
        description.push(type + ' ' + $t(`e-mail`) + ': ' + parent.email);
    }
    if (parent.address) {
        description.push(type + ' ' + $t(`adres`) + ': ' + parent.address.toString());
    }
    if (parent.nationalRegisterNumber) {
        description.push(type + ' ' + $t(`rijksregisternummer`) + ': ' + parent.nationalRegisterNumber.toString());
    }
    return description;
}

function openResultView() {
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: $t(`Wijzigingen`),
        description: $t(`Dit is een overzicht van alle wijzigingen die we gaan doorvoeren als je verder gaat met deze import.`),
        members: props.importMemberResults.map((member) => {
            let description: string[] = [];
            const registration = memberImporter.buildRegistration(member, isWaitingList.value);

            if (registration !== null) {
                const group = groups.find(g => g.id === registration.group.id);
                const groupName = (group?.settings.name ?? $t(`onbekende groep`));

                let suffix = '';

                if (member.importRegistrationResult.paidPrice !== null) {
                    suffix = ` (${$t('{price} betaald', { price: Formatter.price(member.importRegistrationResult.paidPrice) })})`;
                }
                else if (member.importRegistrationResult.paid || paid.value) {
                    suffix = ` (${$t('reeds betaald')})`;
                }
                else {
                    suffix = ` (${$t('nog niet betaald')})`;
                }

                if (member.existingMember) {
                    if (registration !== null) {
                        if (registration.group.type === GroupType.WaitingList) {
                            description.push($t(`Wachtlijst plaatsen voor {group}`, { group: groupName }) + suffix);
                        }
                        else {
                            description.push($t(`Inschrijven voor {group}`, { group: groupName }) + suffix);
                        }

                        // Delete conflicting registrations (based on categories too!)
                        const deleteRegs = memberImporter.getOverrideRegistrations(registration, member);
                        for (const r of deleteRegs) {
                            const groupName = (groups.find(g => g.id === r.groupId)?.settings.name ?? $t(`onbekende groep`));
                            if (r.group.type === GroupType.WaitingList) {
                                description.push($t(`Verwijderen van wachtlijst van {group}`, { group: groupName }));
                            }
                            else {
                                description.push($t(`Verwijderen inschrijving voor {group}`, { group: groupName }));
                            }
                        }
                    }
                }
                else {
                    if (registration.group.type === GroupType.WaitingList) {
                        description.push($t(`Toevoegen in het systeem en op wachtlijst plaatsen voor {group}`, { group: groupName }) + suffix);
                    }
                    else {
                        description.push($t(`Toevoegen in het systeem met inschrijving voor {group}`, { group: groupName }) + suffix);
                    }
                }
            }
            else if (member.isExisting) {
                description.push($t(`Geen wijziging aan inschrijvingen`));
            }

            if (member.existingMember) {
                const existingDetails = member.existingMember.member.details;
                const patched = member.patchedDetails;

                if (patched.name !== undefined && existingDetails.name !== patched.name) {
                    description.push($t(`Naam wijzigen naar {name}`, { name: patched.name }));
                }
                if (patched.nationalRegisterNumber && patched.nationalRegisterNumber !== existingDetails.nationalRegisterNumber) {
                    description.push($t(`Rijksregisternummer wijzigen naar {nationalRegisterNumber}`, { nationalRegisterNumber: patched.nationalRegisterNumber.toString() }));
                }
                if (patched.gender !== undefined && existingDetails.gender !== patched.gender) {
                    description.push($t(`Geslacht wijzigen naar {gender}`, { gender: getGenderName(patched.gender) }));
                }
                if (patched.email !== undefined && patched.email && existingDetails.email !== patched.email) {
                    description.push($t(`E-mail wijzigen naar {email}`, { email: patched.email }));
                }
                if (patched.phone !== undefined && patched.phone && existingDetails.phone !== patched.phone) {
                    description.push($t(`Telefoonnummer wijzigen naar {phone}`, { phone: patched.phone }));
                }
                if (patched.birthDay && (!existingDetails.birthDay || (Formatter.dateIso(existingDetails.birthDay) !== Formatter.dateIso(patched.birthDay)))) {
                    description.push($t(`Geboortedatum wijzigen naar {birthDay}`, { birthDay: Formatter.date(patched.birthDay, true) }));
                }

                if (patched.address && patched.address.toString() !== existingDetails.address?.toString()) {
                    description.push($t(`Adres wijzigen naar {address}`, { address: patched.address.toString() }));
                }

                if (patched.memberNumber && patched.memberNumber !== existingDetails.memberNumber) {
                    description.push($t(`Lidnummer wijzigen naar {memberNumber}`, { memberNumber: patched.memberNumber }));
                }

                if (patched.uitpasNumber && patched.uitpasNumber !== existingDetails.uitpasNumber) {
                    description.push($t(`UiTPAS-nummer wijzigen naar {number}`, { number: patched.uitpasNumber }));
                }

                for (const parent of member.getChangedParents()) {
                    description.push(...getParentDescription(parent));
                }

                for (const answer of member.getChangedRecordAnswers()) {
                    description.push($t('{key} wijzigen naar {value}', { key: answer.settings.name, value: answer.stringValue }));
                }
            }
            else {
                const patched = member.patchedDetails;

                if (patched.name) {
                    description.push($t(`Naam`) + ': ' + patched.name);
                }
                if (patched.nationalRegisterNumber) {
                    description.push($t(`Rijksregisternummer`) + ': ' + patched.nationalRegisterNumber.toString());
                }
                if (patched.gender) {
                    description.push($t(`Geslacht`) + ': ' + getGenderName(patched.gender));
                }
                if (patched.email) {
                    description.push($t(`E-mail`) + ': ' + patched.email);
                }
                if (patched.phone) {
                    description.push($t(`Telefoonnummer`) + ': ' + patched.phone);
                }
                if (patched.birthDay) {
                    description.push($t(`Geboortedatum`) + ': ' + Formatter.date(patched.birthDay, true));
                }

                if (patched.address) {
                    description.push($t(`Adres`) + ': ' + patched.address.toString());
                }

                if (patched.memberNumber) {
                    description.push($t(`Lidnummer`) + ': ' + patched.memberNumber);
                }

                if (patched.uitpasNumber) {
                    description.push($t(`UiTPAS-nummer`) + ': ' + patched.uitpasNumber);
                }

                for (const parent of patched.parents) {
                    description.push(...getParentDescription(parent));
                }

                for (const answer of patched.recordAnswers.values()) {
                    description.push($t('{key} wijzigen naar {value}', { key: answer.settings.name, value: answer.stringValue }));
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
        title: $t(`Leden die in geen enkele groep passen`),
        description: $t(`Dit zijn alle leden waarvoor we geen geschikte leeftijdsgroep konden vinden: omdat ze te oud of te jong zijn bijvoorbeeld. Pas de instellingen van jouw inschrijvingsgroepen eventueel aan.`),
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

    const toast = new Toast($t(`Bezig met importeren...`), 'spinner').setHide(null).show();

    try {
        autoAssignMembers(props.importMemberResults);
        const reports = await memberImporter.importResults(props.importMemberResults, {
            isWaitingList: isWaitingList.value,
            paid: paid.value,
        });

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
            new Toast($t(`Importeren voltooid`), 'success green').show();
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
