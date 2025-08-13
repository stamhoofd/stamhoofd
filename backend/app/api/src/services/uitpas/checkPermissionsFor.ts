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
            human: $t('7d3a6b57-f81a-4d58-bc2b-babb2261c40b'),
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
                human: $t('7d3a6b57-f81a-4d58-bc2b-babb2261c40b'),
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
            human: $t(`542b793c-3edf-4505-b33d-199ea409bbda`),
        });
    });
    if (!response.ok) {
        console.error(`Unsuccessful response whe n checking UiTPAS permissions for organization with id ${organizationId}:`, response.statusText);
        throw new SimpleError({
            code: 'unsuccessful_response_checking_permissions',
            message: `Unsuccesful response when checking UiTPAS permissions`,
            human: $t(`ed4e876c-6a40-49a7-ab65-2a4d5f31c13f`),
        });
    }
    const json = await response.json().catch(() => {
        // Handle JSON parsing errors
        throw new SimpleError({
            code: 'invalid_json_checking_permissions',
            message: `Invalid json when checking UiTPAS permissions`,
            human: $t(`93004d03-955a-4a9a-937d-2f30841dc5cc`),
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
        const organizers = Formatter.joinLast(json.map(i => i.organizer.name), ', ', ' ' + $t('6d35156d-e452-4b0f-80f4-b1e9024d08ee') + ' ');
        return {
            status: UitpasClientCredentialsStatus.NoPermissions,
            human: $t('96c8a719-dba5-47ce-bb61-ee0754a5f776') + organizers,
        };
    }
    const missingPermissions = neededPermissions.filter(needed => !item.permissions.includes(needed.permission));
    if (missingPermissions.length > 0) {
        const missingPermissionsHuman = Formatter.joinLast(missingPermissions.map(p => p.human), ', ', ' ' + $t('6d35156d-e452-4b0f-80f4-b1e9024d08ee') + ' ');
        return {
            status: UitpasClientCredentialsStatus.MissingPermissions,
            human: $t('040fa935-5cbc-4a85-b578-354bf9d7fc04') + missingPermissionsHuman,
        };
    }
    return {
        status: UitpasClientCredentialsStatus.Ok,
    };
}
