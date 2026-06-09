import { Formatter } from "@stamhoofd/utility";
import {
    getSGVSyncStatus,
    isSGVManagedMember,
    MemberWithRegistrationsBlob,
    Organization,
    OrganizationType,
    SGVSyncStatus,
    UmbrellaOrganization,
} from "@stamhoofd/structures";

/** Builds the member-list SGV warning for Scouts organizations by summarizing only active SGV-managed members. */
export function getSGVSyncWarning(
    members: MemberWithRegistrationsBlob[],
    organization: Organization | null,
    hasFullAccess: boolean,
): {
    status:
        | SGVSyncStatus.Never
        | SGVSyncStatus.Outdated
        | SGVSyncStatus.Changed;
    text: string;
} | null {
    if (
        !organization ||
        organization.meta.type !== OrganizationType.Youth ||
        organization.meta.umbrellaOrganization !==
            UmbrellaOrganization.ScoutsEnGidsenVlaanderen
    ) {
        return null;
    }

    const counts = {
        [SGVSyncStatus.Never]: 0,
        [SGVSyncStatus.Outdated]: 0,
        [SGVSyncStatus.Changed]: 0,
    };

    for (const member of members) {
        if (!isSGVManagedMember(member)) {
            continue;
        }

        const status = getSGVSyncStatus(member, {
            periodId: organization.period.period.id,
        });
        if (
            status === SGVSyncStatus.Never ||
            status === SGVSyncStatus.Outdated ||
            status === SGVSyncStatus.Changed
        ) {
            counts[status] += 1;
        }
    }

    const texts: string[] = [];
    if (counts[SGVSyncStatus.Never] > 0) {
        texts.push(
            Formatter.capitalizeFirstLetter(
                Formatter.pluralText(
                    counts[SGVSyncStatus.Never],
                    $t("lid staat"),
                    $t("leden staan"),
                ),
            ) +
                " " +
                $t(
                    "nog niet in de groepsadministratie van Scouts en Gidsen Vlaanderen. Deze leden zijn mogelijk niet verzekerd.",
                ),
        );
    }
    if (counts[SGVSyncStatus.Outdated] > 0) {
        texts.push(
            Formatter.capitalizeFirstLetter(
                Formatter.pluralText(
                    counts[SGVSyncStatus.Outdated],
                    $t("lid heeft een gewijzigde inschrijving"),
                    $t("leden hebben gewijzigde inschrijvingen"),
                ),
            ) + ".",
        );
    }
    if (counts[SGVSyncStatus.Changed] > 0) {
        texts.push(
            Formatter.capitalizeFirstLetter(
                Formatter.pluralText(
                    counts[SGVSyncStatus.Changed],
                    $t("lid heeft gewijzigde gegevens"),
                    $t("leden hebben gewijzigde gegevens"),
                ),
            ) + ".",
        );
    }

    if (texts.length === 0) {
        return null;
    }

    texts.push(
        hasFullAccess
            ? $t("Synchroniseer met de groepsadministratie.")
            : $t("Vraag je VGA of groepsleiding om te synchroniseren."),
    );

    return {
        status:
            counts[SGVSyncStatus.Never] > 0
                ? SGVSyncStatus.Never
                : counts[SGVSyncStatus.Outdated] > 0
                  ? SGVSyncStatus.Outdated
                  : SGVSyncStatus.Changed,
        text: texts.join(" "),
    };
}
