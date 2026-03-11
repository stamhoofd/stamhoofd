import { SimpleError } from '@simonbackx/simple-errors';
import { UitpasClientCredentialsStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

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
            human: $t('%1BL'),
        });
    }

    for (const item of json) {
        if (
            typeof item !== 'object' || item === null
            || !('organizer' in item)
            || typeof (item as any).organizer !== 'object' || (item as any).organizer === null
            || typeof (item as any).organizer.id !== 'string'
            || typeof (item as any).organizer.name !== 'string'
            || !('permissions' in item)
            || !Array.isArray((item as any).permissions)
            || !(item as any).permissions.every((perm: unknown) => typeof perm === 'string')
        ) {
            console.error('Invalid PermissionsResponse:', json);
            throw new SimpleError({
                code: 'invalid_permissions_response',
                message: 'Invalid response format for permissions',
                human: $t('%1BL'),
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
            human: $t(`%1BP`),
        });
    });
    if (!response.ok) {
        console.error(`Unsuccessful response whe n checking UiTPAS permissions for organization with id ${organizationId}:`, response.statusText);
        throw new SimpleError({
            code: 'unsuccessful_response_checking_permissions',
            message: `Unsuccesful response when checking UiTPAS permissions`,
            human: $t(`%18C`),
        });
    }
    const json = await response.json().catch(() => {
        // Handle JSON parsing errors
        throw new SimpleError({
            code: 'invalid_json_checking_permissions',
            message: `Invalid json when checking UiTPAS permissions`,
            human: $t(`%18A`),
        });
    });
    assertIsPermissionsResponse(json);
    const neededPermissions = organizationId
        ? [{
                permission: 'PASSES_READ',
                human: 'Basis UiTPAS informatie ophalen met UiTPAS nummer',
            }]
        : [{
                permission: 'TARIFFS_READ',
                human: 'Tarieven opvragen',
            }, {
                permission: 'TICKETSALES_REGISTER',
                human: 'Ticketsales registreren',
            }, {
                permission: 'TICKETSALES_SEARCH',
                human: 'Ticketsales zoeken',
            }];
    const item = json.find(item => item.organizer.id === uitpasOrganizerId);
    if (!item) {
        const organizers = Formatter.joinLast(json.map(i => i.organizer.name), ', ', ' ' + $t('%1BM') + ' ');
        return {
            status: UitpasClientCredentialsStatus.NoPermissions,
            human: $t('%1BN') + organizers,
        };
    }
    const missingPermissions = neededPermissions.filter(needed => !item.permissions.includes(needed.permission));
    if (missingPermissions.length > 0) {
        const missingPermissionsHuman = Formatter.joinLast(missingPermissions.map(p => p.human), ', ', ' ' + $t('%1BM') + ' ');
        return {
            status: UitpasClientCredentialsStatus.MissingPermissions,
            human: $t('%1BO') + missingPermissionsHuman,
        };
    }
    return {
        status: UitpasClientCredentialsStatus.Ok,
    };
}
