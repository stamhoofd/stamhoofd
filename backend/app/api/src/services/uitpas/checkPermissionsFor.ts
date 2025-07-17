import { SimpleError } from "@simonbackx/simple-errors";
import { UitpasClientCredentialsStatus } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

type PermissionsResponse = Array<{
    organizer: {
        id: string;
        name: string;
    };
    permissions: Array<string>;
}>;

function assertIsPermissionsResponse(json: unknown): asserts json is PermissionsResponse {
    if (!Array.isArray(json)) {
        console.error('Invalid PermissionsResponse:', json);
        throw new SimpleError({
            code: 'invalid_permissions_response',
            message: 'Invalid response format for permissions',
            human: $t('Er is iets misgelopen bij het ophalen van je rechten. Probeer het later opnieuw.'),
        });
    }

    for (const item of json) {
        if (
            typeof item !== 'object' || item === null ||
            !('organizer' in item) ||
            typeof (item as any).organizer !== 'object' || (item as any).organizer === null ||
            typeof (item as any).organizer.id !== 'string' ||
            typeof (item as any).organizer.name !== 'string' ||
            !('permissions' in item) ||
            !Array.isArray((item as any).permissions) ||
            !(item as any).permissions.every((perm: unknown) => typeof perm === 'string')
        ) {
            console.error('Invalid PermissionsResponse:', json);
            throw new SimpleError({
                code: 'invalid_permissions_response',
                message: 'Invalid response format for permissions',
                human: $t('Er is iets misgelopen bij het ophalen van je rechten. Probeer het later opnieuw.'),
            });
        }
    }
}

export async function checkPermissionsFor(access_token: string, organizationId: string | null, uitpasOrganizerId: string) {
    const url = 'https://api-test.uitpas.be/permissions';
    const myHeaders = new Headers();
    myHeaders.append('Authorization', 'Bearer ' + access_token);
    myHeaders.append('Accept', 'application/json');
    const response = await fetch(url, {
        method: 'GET',
        headers: myHeaders,
    }).catch(() => {
        // Handle network errors
        throw new SimpleError({
            code: 'uitpas_unreachable_checking_permissions',
            message: `Network issue when checking UiTPAS permissions`,
            human: $t(`We konden UiTPAS niet bereiken om de rechten te controleren. Probeer het later opnieuw.`),
        });
    });
    if (!response.ok) {
        console.error(`Unsuccessful response whe n checking UiTPAS permissions for organization with id ${organizationId}:`, response.statusText);
        throw new SimpleError({
            code: 'unsuccessful_response_checking_permissions',
            message: `Unsuccesful response when checking UiTPAS permissions`,
            human: $t(`Er is een fout opgetreden bij het verbinden met UiTPAS. Probeer het later opnieuw.`),
        });
    }
    const json = await response.json().catch(() => {
        // Handle JSON parsing errors
        throw new SimpleError({
            code: 'invalid_json_checking_permissions',
            message: `Invalid json when checking UiTPAS permissions`,
            human: $t(`Er is een fout opgetreden bij het communiceren met UiTPAS. Probeer het later opnieuw.`),
        });
    });
    assertIsPermissionsResponse(json);
    const neededPermissions = organizationId ? [{
        permission: 'PASSES_READ',
        human: 'Basis UiTPAS informatie ophalen met UiTPAS nummer'
    }] : [{
        permission: 'TARIFFS_READ',
        human: 'Tarieven opvragen'
    }, {
        permission: 'TICKETSALES_REGISTER',
        human: 'Ticketsales registreren'
    }, {
        permission: 'TICKETSALES_SEARCH',
        human: 'Ticketsales zoeken'
    }];
    const item = json.find((item) => item.organizer.id === uitpasOrganizerId);
    if (!item) {
        const organizers = Formatter.joinLast(json.map((i) => i.organizer.name), ', ', ' ' + $t(' en ') + ' ')
        return {
            status: UitpasClientCredentialsStatus.NO_PERMISSIONS,
            human: $t('Jouw UiTPAS-integratie heeft geen toegansrechten tot de geselecteerde UiTPAS-organisator, maar wel tot ') + organizers,
        };
    }
    const missingPermissions = neededPermissions.filter((needed) => !item.permissions.includes(needed.permission));
    if (missingPermissions.length > 0) {
        const missingPermissionsHuman = Formatter.joinLast(missingPermissions.map((p) => p.human), ', ', ' ' + $t(' en ') + ' ');
        return {
            status: UitpasClientCredentialsStatus.MISSING_PERMISSIONS,
            human: $t('Jouw UiTPAS-integratie mist de volgende toegangsrechten voor de geselecteerde UiTPAS-organisator: ') + missingPermissionsHuman,
        };
    }
    return {
        status: UitpasClientCredentialsStatus.OK
    };
}
