<template>
    <SaveView :title="$t('Leden importeren')" :loading="saving" :save-text="`Importeer ${importMemberResults.length} leden`" @save="goNext">
        <h1>Importeer instellingen</h1>
        <p>We hebben nog wat aanvullende vragen over hoe we de leden moeten importeren.</p>
        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="!saving">
            <p v-if="existingCount > 0 && existingCount === importMemberResults.length" class="warning-box">
                Alle leden uit jouw bestand zitten al in het systeem. Als je kolommen hebt met gegevensvelden gaan die de gegevens in Stamhoofd overschrijven. <template v-if="membersWithNewRegistrations.length">
                    Er zullen ook nieuwe inschrijvingen bij deze bestaande leden worden toegevoegd.
                </template>Let goed op, je kan dit niet ongedaan maken.
            </p>
            <p v-else-if="existingCount > 0" class="warning-box">
                {{ existingCount }} {{ existingCount == 1 ? 'lid' : 'leden' }} uit jouw bestand zitten al in het systeem ({{ importMemberResults.length }} in totaal). Je gaat informatie in Stamhoofd overschrijven met informatie uit jouw bestand voor deze leden. Let goed op, je kan dit niet ongedaan maken.
            </p>

            <p v-if="deletedRegistrationsCount > 0" class="warning-box">
                Stamhoofd zal {{ deletedRegistrationsCount }} inschrijvingen of wachtlijst inschrijvingen verplaatsen voor bestaande leden op basis van jouw bestand.
            </p>
            <p v-if="membersWithoutNewRegistrations.length" class="success-box">
                {{ membersWithoutNewRegistrations.length }} leden uit jouw lijst zijn al ingeschreven. Hun huidige inschrijving(en) zullen niet worden aangepast, ze zullen ook geen nieuwe inschrijvingen krijgen. Hun andere gegevens uit het bestand zullen wel in Stamhoofd worden overgenomen.
            </p>

            <template v-if="membersWithNewRegistrations.length">
                <hr>
                <h2>Inschrijvingstatus</h2>

                <STInputBox v-if="hasWaitingLists" title="Wil je deze leden op de wachtlijst zetten?" error-fields="waitingList" :error-box="errors.errorBox" class="max">
                    <RadioGroup>
                        <Radio v-model="isWaitingList" :value="false">
                            Nee
                        </Radio>
                        <Radio v-model="isWaitingList" :value="true">
                            Ja, zet op wachtlijst
                        </Radio>
                    </RadioGroup>
                </STInputBox>

                <template v-if="!isWaitingList">
                    <STInputBox v-if="needsPaidStatus" :title="'Hebben deze leden al betaald?'" error-fields="paid" :error-box="errors.errorBox" class="max">
                        <RadioGroup>
                            <Radio v-model="paid" :value="true">
                                Al betaald
                            </Radio>
                            <Radio v-model="paid" :value="false">
                                Niet betaald
                            </Radio>
                            <Radio v-model="paid" :value="null">
                                Sommigen wel, anderen niet
                            </Radio>
                        </RadioGroup>
                    </STInputBox>
                    <p v-if="!needsPaidStatus && somePaid" class="success-box">
                        De betaalstatus uit jouw Excel-bestand zal worden gebruikt om de inschrijvingen met het juiste bedrag aan te maken.
                    </p>

                    <p v-if="needsPaidStatus && somePaid" class="warning-box">
                        Van sommige leden hebben we in het bestand wel al de nodige betaalinformatie gevonden, bij hen wordt die informatie gebruikt en het bovenstaande genegeerd.
                    </p>

                    <p v-if="needsPaidStatus && paid === null" class="warning-box">
                        We zetten de betaalstatus van alle leden op 'niet betaald'. Jij moet achteraf dan aanduiden wie al betaald heeft. Als je dat niet wilt doen, kan je de betaalstatus opnemen in jouw bestand door een extra kolom 'Betaald' toe te voegen en daar ja/nee in te zetten.
                    </p>
                </template>
            </template>

            <template v-if="needsGroupAssignment">
                <hr>
                <h2>Inschrijvingsgroep</h2>

                <p class="warning-box">
                    {{ membersNeedingAssignment.length }} leden uit jouw lijst hebben geen inschrijvingsgroep toegewezen gekregen (in een kolom). Kies hieronder hoe je deze wilt inschrijven in de juiste groep, of voeg een kolom in jouw bestand toe met de groep waar je elk lid wilt inschrijven.
                </p>

                <STInputBox title="Leeftijdsgroep toewijzen" error-fields="group" :error-box="errors.errorBox" class="max">
                    <RadioGroup>
                        <Radio v-model="autoAssign" :value="true">
                            Automatisch groep bepalen
                        </Radio>
                        <Radio v-model="autoAssign" :value="false">
                            Allemaal in één groep inschrijven
                        </Radio>
                    </RadioGroup>

                    <template #right>
                        <button class="button text" type="button" @click.stop="openAssignment">
                            <span class="icon help" />
                            <span>Toon resultaat</span>
                        </button>
                    </template>
                </STInputBox>

                <template v-if="autoAssign">
                    <STInputBox v-if="membersWithMultipleGroups.length > 0" title="Prioriteit van groepen" error-fields="group" :error-box="errors.errorBox" class="max">
                        <p class="info-box">
                            {{ membersWithMultipleGroups.length }} {{ membersWithMultipleGroups.length == 1 ? 'lid past' : 'leden passen' }} in meer dan één groep. Je kan hieronder een prioriteit instellen. Dan schrijven we elk lid in bij één van groepen waar hij in past die de hoogste prioriteit heeft. Als je wilt kan je de leeftijd of geslacht van elke leeftijdsgroep (tijdelijk) beperken om op die manier automatisch de juiste leeftijdsgroep te kiezen (dat doe je bij instellingen > inschrijvingsgroepen)
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
                                <span>Toon leden</span>
                            </button>
                        </template>
                    </STInputBox>

                    <STInputBox v-if="membersWithoutMatchingGroups.length > 0" title="In welke groep wil je leden inschrijven die nergens in passen?" error-fields="group" :error-box="errors.errorBox" class="max">
                        <p class="info-box">
                            {{ membersWithoutMatchingGroups.length }} leden passen in geen enkele groep. Kies hieronder in welke groep je deze toch wilt inschrijven.
                        </p>

                        <Dropdown v-model="defaultGroup">
                            <option v-for="group in groups" :key="group.id" :value="group">
                                {{ group.settings.name }}
                            </option>
                        </Dropdown>

                        <template #right>
                            <button type="button" class="button text" @click.stop="openWithoutMatchingGroups">
                                <span class="icon help" />
                                <span>Toon leden</span>
                            </button>
                        </template>
                    </STInputBox>
                </template>
                <template v-else>
                    <STInputBox title="In welke groep wil je deze leden inschrijven?" error-fields="group" :error-box="errors.errorBox" class="max">
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
import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { Dropdown, Radio, RadioGroup, startRegister, STErrorsDefault, STInputBox, STList, STListItem, Toast, useContext, useErrors, useNavigationActions, usePlatform, usePlatformFamilyManager, useRequiredOrganization } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { BalanceItem, BalanceItemPaymentDetailed, DetailedReceivableBalance, getGenderName, Group, GroupPrice, GroupType, OrganizationRegistrationPeriod, Parent, ParentTypeHelper, PaymentGeneral, PaymentMethod, PaymentStatus, PaymentType, PlatformFamily, PlatformMember, ReceivableBalanceType, RegisterCheckout, RegisterItem, Registration, RegistrationWithPlatformMember, TranslatedString } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, Ref, ref, watch } from 'vue';
import { ImportMemberResult } from '../../../../../classes/import/ImportMemberResult';
import ImportAutoAssignedView from './ImportAutoAssignedView.vue';

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

const membersWithNewRegistrations = computed(() => props.importMemberResults.filter(m => hasNewRegistration(m)));

const membersWithoutNewRegistrations = computed(() => props.importMemberResults.filter(m => !hasNewRegistration(m)));

const deletedRegistrationsCount = computed(() => {
    return membersWithNewRegistrations.value.reduce((acc, m) => {
        const registration = buildRegistration(m);
        if (!registration) {
            return acc;
        }
        return acc + getOverrideRegistrations(registration, m).length;
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
        title: 'Wijzigingen aan inschrijvingen',
        description: 'Hier zie je bij welke groep we elk lid gaan inschrijven, op basis van jouw instellingen en het bestand',
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
        title: 'Leden die door prioriteit bij ' + group.settings.name + ' zullen worden ingeschreven',
        description: 'Deze leden passen in meerdere groepen, maar op basis van jouw prioriteit bij ' + group.settings.name + ' zullen worden ingeschreven',
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
        title: 'Leden die in meerdere groepen passen',
        description: 'Dit zijn alle leden en de groepen waar ze in passen. Je kan beperken tot welke groepen ze horen door de instellingen van die groep te wijzigen.',
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
        description.push(type + ' telefoonnummer: ' + parent.phone);
    }
    if (parent.email) {
        description.push(type + ' e-mail: ' + parent.email);
    }
    if (parent.address) {
        description.push(type + ' adres: ' + parent.address.toString());
    }
    if (parent.nationalRegisterNumber) {
        description.push(type + ' rijksregisternummer: ' + parent.nationalRegisterNumber.toString());
    }
    return description;
}

function openResultView() {
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: 'Wijzigingen',
        description: 'Dit is een overzicht van alle wijzigingen die we gaan doorvoeren als je verder gaat met deze import.',
        members: props.importMemberResults.map((member) => {
            let description: string[] = [];
            const registration = buildRegistration(member);

            if (registration !== null) {
                const group = groups.find(g => g.id === registration.group.id);
                const groupName = (group?.settings.name ?? 'onbekende groep');

                let suffix = '';

                if (member.importRegistrationResult.paidPrice !== null) {
                    suffix = ` (${Formatter.price(member.importRegistrationResult.paidPrice)} betaald)`;
                }
                else if (member.importRegistrationResult.paid || paid.value) {
                    suffix = ` (reeds betaald)`;
                }
                else {
                    suffix = ` (nog niet betaald)`;
                }

                if (member.existingMember) {
                    if (registration !== null) {
                        if (registration.group.type === GroupType.WaitingList) {
                            description.push('Wachtlijst plaatsen voor ' + groupName + suffix);
                        }
                        else {
                            description.push('Inschrijven voor ' + groupName + suffix);
                        }

                        // Delete conflicting registrations (based on categories too!)
                        const deleteRegs = getOverrideRegistrations(registration, member);
                        for (const r of deleteRegs) {
                            const groupName = (groups.find(g => g.id === r.groupId)?.settings.name ?? 'onbekende groep');
                            if (r.group.type === GroupType.WaitingList) {
                                description.push('Verwijderen van wachtlijst van ' + groupName);
                            }
                            else {
                                description.push('Verwijderen inschrijving voor ' + groupName);
                            }
                        }
                    }
                }
                else {
                    if (registration.group.type === GroupType.WaitingList) {
                        description.push('Toevoegen in het systeem en op wachtlijst plaatsen voor ' + groupName + suffix);
                    }
                    else {
                        description.push('Toevoegen in het systeem met inschrijving voor ' + groupName + suffix);
                    }
                }
            }
            else if (member.isExisting) {
                description.push('Geen wijziging aan inschrijvingen');
            }

            if (member.existingMember) {
                const existingDetails = member.existingMember.member.details;
                const patched = member.patchedDetails;

                if (patched.name !== undefined && existingDetails.name !== patched.name) {
                    description.push('Naam wijzigen naar ' + patched.name);
                }
                if (patched.nationalRegisterNumber && patched.nationalRegisterNumber !== existingDetails.nationalRegisterNumber) {
                    description.push('Rijksregisternummer wijzigen naar ' + patched.nationalRegisterNumber.toString());
                }
                if (patched.gender !== undefined && existingDetails.gender !== patched.gender) {
                    description.push('Geslacht wijzigen naar ' + getGenderName(patched.gender));
                }
                if (patched.email !== undefined && patched.email && existingDetails.email !== patched.email) {
                    description.push('E-mail wijzigen naar ' + patched.email);
                }
                if (patched.phone !== undefined && patched.phone && existingDetails.phone !== patched.phone) {
                    description.push('Telefoonnummer wijzigen naar ' + patched.phone);
                }
                if (patched.birthDay && (!existingDetails.birthDay || (Formatter.dateIso(existingDetails.birthDay) !== Formatter.dateIso(patched.birthDay)))) {
                    description.push('Geboortedatum wijzigen naar ' + Formatter.date(patched.birthDay, true));
                }

                if (patched.address && patched.address.toString() !== existingDetails.address?.toString()) {
                    description.push('Adres wijzigen naar ' + patched.address.toString());
                }

                if (patched.memberNumber && patched.memberNumber !== existingDetails.memberNumber) {
                    description.push('Lidnummer wijzigen naar ' + patched.memberNumber);
                }

                if (patched.uitpasNumber && patched.uitpasNumber !== existingDetails.uitpasNumber) {
                    description.push('UiTPAS-nummer wijzigen naar ' + patched.uitpasNumber);
                }

                for (const parent of member.getChangedParents()) {
                    description.push(...getParentDescription(parent));
                }

                for (const answer of member.getChangedRecordAnswers()) {
                    description.push(answer.settings.name + ' wijzigen naar ' + answer.stringValue);
                }
            }
            else {
                const patched = member.patchedDetails;

                if (patched.name) {
                    description.push('Naam: ' + patched.name);
                }
                if (patched.nationalRegisterNumber) {
                    description.push('Rijksregisternummer: ' + patched.nationalRegisterNumber.toString());
                }
                if (patched.gender) {
                    description.push('Geslacht: ' + getGenderName(patched.gender));
                }
                if (patched.email) {
                    description.push('E-mail: ' + patched.email);
                }
                if (patched.phone) {
                    description.push('Telefoonnummer: ' + patched.phone);
                }
                if (patched.birthDay) {
                    description.push('Geboortedatum: ' + Formatter.date(patched.birthDay, true));
                }

                if (patched.address) {
                    description.push('Adres: ' + patched.address.toString());
                }

                if (patched.memberNumber) {
                    description.push('Lidnummer: ' + patched.memberNumber);
                }

                if (patched.uitpasNumber) {
                    description.push('UiTPAS-nummer: ' + patched.uitpasNumber);
                }

                for (const parent of patched.parents) {
                    description.push(...getParentDescription(parent));
                }

                for (const answer of patched.recordAnswers.values()) {
                    description.push(answer.settings.name + ' wijzigen naar ' + answer.stringValue);
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
        title: 'Leden die in geen enkele groep passen',
        description: 'Dit zijn alle leden waarvoor we geen geschikte leeftijdsgroep konden vinden: omdat ze te oud of te jong zijn bijvoorbeeld. Pas de instellingen van jouw inschrijvingsgroepen eventueel aan.',
        members: membersWithoutMatchingGroups.value.flatMap((m) => {
            return [{
                name: m.patchedDetails.name,
                group: '/',
            }];
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

function hasNewRegistration(member: ImportMemberResult) {
    const group = (member.importRegistrationResult.group ?? member.importRegistrationResult.autoAssignedGroup);

    if (!group) {
        return false;
    }

    // Check if we are already registered for this group
    if (member.existingMember) {
        const periodId = props.period.period.id;
        const existing = member.existingMember.filterRegistrations({ groups: [group], periodId });

        if (existing.length && isWaitingList.value) {
            return false;
        }

        if (existing.length && !isWaitingList.value && existing.find(e => !(e.group.type === GroupType.WaitingList))) {
            // already registered
            return false;
        }
    }

    return true;
}

interface RegistrationData {
    group: Group;
    groupPrice: GroupPrice | null;
    customStartDate: Date | null;
}

const context = useContext();

function createCheckout(importMemberResults: ImportMemberResult[]): RegisterCheckout {
    const checkout = new RegisterCheckout();
    checkout.asOrganizationId = organization.value.id;

    for (const importResult of importMemberResults) {
        const member = importResult.getCheckoutMember();
        member.family.checkout = checkout;
        member.family.pendingRegisterItems = [];

        const organization = importResult.organization;

        const regsitrationData = buildRegistration(importResult);

        if (regsitrationData) {
            const registrationsToRemove = getOverrideRegistrations(regsitrationData, importResult);
            const group = regsitrationData.group;
            importResult.setCheckedOutGroup(group);

            const item = new RegisterItem({
                member,
                group,
                organization,
                customStartDate: regsitrationData?.customStartDate,
                groupPrice: regsitrationData?.groupPrice ?? undefined,
                recordAnswers: importResult.importRegistrationResult.recordAnswers.size ? importResult.importRegistrationResult.recordAnswers : undefined,
            });

            for (const registration of registrationsToRemove) {
                checkout.removeRegistration(new RegistrationWithPlatformMember({ registration, member }), { calculate: false });
            }

            checkout.add(item, { calculate: false });
        }
    }

    return checkout;
}

function getGroupPrice(group: Group, matchPrice?: { priceValue?: number; priceName?: string; isReducedPrice: boolean }): GroupPrice {
    const prices = group.settings.getFilteredPrices({ admin: true });
    let matchedOnName: GroupPrice[] = [];
    let matchedOnPrice: GroupPrice[] = [];

    for (const price of prices) {
        if (matchPrice !== undefined) {
            const { priceValue, priceName, isReducedPrice } = matchPrice;

            if (priceName !== undefined) {
                if (price.name.toString() !== priceName) {
                    continue;
                }
                matchedOnName.push(price);
            }

            if (priceValue !== undefined) {
                if (isReducedPrice) {
                    if (price.price.reducedPrice !== priceValue) {
                        continue;
                    }
                }
                else if (price.price.price !== priceValue) {
                    continue;
                }

                matchedOnPrice.push(price);
            }
        }

        const stock = price.getRemainingStock(group);
        if (stock !== 0) {
            return price;
        }
    }

    // Probably all sold out
    // Select the first one anyway

    if (matchPrice?.priceName !== undefined && matchedOnName.length > 0) {
        return matchedOnName[0];
    }

    if (matchPrice?.priceValue !== undefined && matchedOnPrice.length > 0) {
        return matchedOnPrice[0];
    }

    return prices[0] ?? GroupPrice.create({ name: TranslatedString.create($t('83c99392-7efa-44d3-8531-1843c5fa7c4d')), id: '' });
}

function buildRegistration(member: ImportMemberResult): RegistrationData | null {
    if (!hasNewRegistration(member)) {
        return null;
    }

    let group = (member.importRegistrationResult.group ?? member.importRegistrationResult.autoAssignedGroup);

    if (!group) {
        return null;
    }

    let groupPrice: GroupPrice | null = null;

    if (isWaitingList.value) {
        if (group.waitingList) {
            group = group.waitingList;
        }
    }
    else {
        const isReducedPrice = member.patchedDetails.shouldApplyReducedPrice;
        groupPrice = getGroupPrice(group, {
            priceValue: member.importRegistrationResult.price === null ? undefined : member.importRegistrationResult.price,
            priceName: member.importRegistrationResult.priceName === null ? undefined : member.importRegistrationResult.priceName,
            isReducedPrice,
        });
    }

    const registrationData: RegistrationData = {
        group,
        groupPrice,
        customStartDate: member.importRegistrationResult.date ?? new Date(),
    };

    return registrationData;
}

function getOverrideRegistrations(registration: RegistrationData, member: ImportMemberResult): Registration[] {
    if (!member.existingMember) {
        return [];
    }

    let list: Registration[] = [];

    const group = registration.group;
    const periodId = props.period.period.id;

    const parents = group.getParentCategories(props.period.availableCategories, false);

    for (const parent of parents) {
        const groupsInParent = parent.groupIds.map(id => groups.find(g => g.id === id)).filter(g => !!g) as Group[];

        if (parent.settings.maximumRegistrations === 1) {
            // Delete all registrations for these groups
            const existing = member.existingMember.filterRegistrations({ groups: groupsInParent, periodId });
            for (const r of existing) {
                if (list.find(l => l.id === r.id)) {
                    continue;
                }
                list.push(r);
            }
        }
    }
    return list;
}

function getExistingFamilies(importMemberResults: ImportMemberResult[]) {
    const result = new Map<string, PlatformFamily>();

    for (const importResult of importMemberResults) {
        if (importResult.existingMember) {
            const existingFamily = importResult.existingMember.family;
            const uuid = existingFamily.uuid;

            if (result.has(uuid)) {
                continue;
            }
            else {
                result.set(uuid, existingFamily);
            }
        }
    }

    return [...result.values()];
}

function regroupNewMembersInFamilies(importMemberResults: ImportMemberResult[]) {
    const existingFamilies = getExistingFamilies(importMemberResults);

    for (const importResult of importMemberResults) {
        const newPlatformMember = importResult.newPlatformMember;

        if (newPlatformMember !== null) {
            const family = existingFamilies.find(f => f.belongsToFamily(newPlatformMember.member));

            if (family) {
                family.add(newPlatformMember);
            }
            else {
                const family = newPlatformMember.family;
                if (!existingFamilies.includes(family)) {
                    existingFamilies.push(family);
                }
            }
        }
    }
}

async function importResults(importMemberResults: ImportMemberResult[]) {
    if (importMemberResults.find(m => !m.isExisting && m.importRegistrationResult.group === null)) {
        throw new SimpleError({
            code: 'no_group',
            message: 'Er is een nieuw lid zonder groep.',
        });
    }

    await importMembers(importMemberResults);
    await importRegistrations(importMemberResults);
    await importPayments(importMemberResults);
}

async function importMembers(importMemberResults: ImportMemberResult[]) {
    const notImportedMembers = importMemberResults.filter(m => !m.isMemberImported);
    const allPlatformMembers: PlatformMember[] = [];
    const registerCallbacksAfterSave: (() => void)[] = [];

    for (const imporResult of notImportedMembers) {
        const platformMember = imporResult.getPatchedPlatformMember(platform.value);
        allPlatformMembers.push(platformMember);
        registerCallbacksAfterSave.push(() => imporResult.setImportedPlatformMember(platformMember));
    }

    if (!allPlatformMembers.length) {
        return;
    }

    await platformFamilyManager.save(allPlatformMembers, true);
    // the backend will add users to the member -> the new members should be regrouped in families
    regroupNewMembersInFamilies(importMemberResults);

    registerCallbacksAfterSave.forEach(callback => callback());
}

async function importRegistrations(importMemberResults: ImportMemberResult[]) {
    const notRegisteredMembers = importMemberResults.filter(m => !m.isRegistrationImported);
    if (!notRegisteredMembers.length) {
        return;
    }
    const checkout = createCheckout(notRegisteredMembers);

    if (checkout.cart.isEmpty) {
        return;
    }

    // add new registrations
    await startRegister({
        checkout,
        context: context.value,
        admin: true,
    }, navigate);

    notRegisteredMembers.forEach(m => m.markRegistrationImported());
}

async function importPayments(importMemberResults: ImportMemberResult[]) {
    const membersWithoutImportedPayment = importMemberResults.filter(m => !m.isPaymentImported);
    if (!membersWithoutImportedPayment.length) {
        return;
    }

    const payments: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();

    for (const importResult of membersWithoutImportedPayment) {
        const checkedOutGroup = importResult.checkedOutGroup;
        if (!checkedOutGroup) {
            continue;
        }

        const registeredPlatformMember = importResult.registeredPlatformMember;
        if (!registeredPlatformMember) {
            continue;
        }

        const paidPrice = importResult.importRegistrationResult.paidPrice;

        if (paidPrice !== null && paidPrice > 0) {
            const balanceItems = await getBalanceItems(registeredPlatformMember, checkedOutGroup);

            let priceLeft = paidPrice;

            const balanceItemPayments: BalanceItemPaymentDetailed[] = [];

            for (const balanceItem of balanceItems) {
                if (priceLeft <= 0) {
                    break;
                }

                const price = Math.min(priceLeft, balanceItem.priceOpen);

                balanceItemPayments.push(BalanceItemPaymentDetailed.create({
                    balanceItem,
                    price,
                }));

                priceLeft -= price;
            }

            const payment = PaymentGeneral.create({
                method: PaymentMethod.Unknown,
                status: PaymentStatus.Succeeded,
                type: PaymentType.Payment,
                paidAt: new Date(),
                customer: null,
                balanceItemPayments,
            });

            payments.addPut(payment);
        }
        else {
            let isPaid = false;

            if (importResult.importRegistrationResult.paid !== null) {
                isPaid = importResult.importRegistrationResult.paid;
            }
            else if (paid.value !== null) {
                isPaid = paid.value;
            }

            if (isPaid) {
                const balanceItems = await getBalanceItems(registeredPlatformMember, checkedOutGroup);
                if (balanceItems.length) {
                    const payment = PaymentGeneral.create({
                        method: PaymentMethod.Unknown,
                        status: PaymentStatus.Succeeded,
                        type: PaymentType.Payment,
                        paidAt: new Date(),
                        customer: null,
                        balanceItemPayments: balanceItems.map(balanceItem => BalanceItemPaymentDetailed.create({
                            balanceItem,
                            price: balanceItem.priceOpen,
                        })),
                    });

                    payments.addPut(payment);
                }
            }
        }
    }

    if (payments.getPuts().length === 0) {
        return;
    }

    await context.value.authenticatedServer.request({
        method: 'PATCH',
        path: '/organization/payments',
        body: payments,
        decoder: new ArrayDecoder(PaymentGeneral),
        shouldRetry: false,
    });

    membersWithoutImportedPayment.forEach(m => m.markPaymentImported());
}

async function getBalanceItems(platformMember: PlatformMember, group: Group): Promise<BalanceItem[]> {
    const registrations = platformMember.filterRegistrations({ groups: [group] });

    if (registrations.length === 1) {
        const registration = registrations[0];

        if (registration.groupPrice.price.price === 0) {
            // not necesary to get balance items if price is 0
            return [];
        }

        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/receivable-balances/${ReceivableBalanceType.registration}/${registration.id}`,
            decoder: DetailedReceivableBalance as Decoder<DetailedReceivableBalance>,
            owner,
        });

        const receivableBalance = response.data;

        return receivableBalance.filteredBalanceItems;
    }

    throw new SimpleError({
        code: 'no_registration',
        message: `Geen registratie gevonden voor ${platformMember.member.name}`,
    });
}

async function goNext() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    const toast = new Toast('Bezig met importeren...', 'spinner').setHide(null).show();

    try {
        autoAssignMembers(props.importMemberResults);
        await importResults(props.importMemberResults);
        toast.hide();

        new Toast('Importeren voltooid', 'success green').show();
        navigate.dismiss({ force: true }).catch(console.error);
    }
    catch (e) {
        toast.hide();
        console.error(e);
        Toast.fromError(e).show();
    }
    saving.value = false;
}
</script>
