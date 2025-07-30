import { UitpasOrganizerResponse, UitpasOrganizersResponse } from '@stamhoofd/structures';
import { SimpleError } from '@simonbackx/simple-errors';

type OrganizersResponse = {
    totalItems: number;
    member: Array<{
        id: string;
        name: string;
    }>;
};

type UitdatabankOrganizerResponse = {
    '@id': string;
    'name': {
        nl?: string; // at least one language required
    };
};

function isUitdatabankOrganizerResponse(json: unknown): json is UitdatabankOrganizerResponse {
    if (typeof json === 'object'
        && json !== null
        && ('@id' in json)
        && typeof json['@id'] === 'string'
        && ('name' in json)
        && typeof json.name === 'object'
        && json.name !== null
    ) {
        return Object.values(json.name).some(value => typeof value === 'string');
    }
    return false;
}

const UITPAS_ORGANISER_URL_REGEX = /^http[s]?:\/\/.+?\/organizer[s]?\/([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-?[0-9A-Fa-f]{12})[/]?$/;
const UITPAS_ID_REGEX = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-?[0-9A-Fa-f]{12}$/;

function assertIsOrganizersResponse(json: unknown): asserts json is OrganizersResponse {
    if (
        typeof json !== 'object'
        || json === null
        || !('totalItems' in json)
        || typeof json.totalItems !== 'number'
        || !('member' in json)
        || !Array.isArray(json.member)
        || !json.member.every(
            (member: unknown) => typeof member === 'object' && member !== null && 'id' in member && typeof member.id === 'string' && 'name' in member && typeof member.name === 'string',
        )
    ) {
        console.error('Invalid response when searching for UiTPAS organizers:', json);
        throw new SimpleError({
            code: 'invalid_response_searching_uitpas_organizers',
            message: `Invalid response when searching for UiTPAS organizers`,
            human: $t(`Er is een fout opgetreden bij het zoeken naar UiTPAS-organisaties. Probeer het later opnieuw.`),
        });
    }
}

export async function searchUitpasOrganizers(accessToken: string, useTestEnv: boolean, name: string): Promise<UitpasOrganizersResponse> {
    // uses platform credentials
    // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-organizers
    if (name === '') {
        throw new SimpleError({
            code: 'empty_uitpas_organizer_name',
            message: `Empty name when searching for UiTPAS organizers`,
            human: $t(`Je moet een naam opgeven om UiTPAS-organisaties te zoeken.`),
        });
    }

    let id = '';
    if (UITPAS_ID_REGEX.test(name)) {
        id = name;
    }
    else {
        const match = name.match(UITPAS_ORGANISER_URL_REGEX);
        if (match) {
            id = match[1];
        }
    }
    if (id) {
        // If we have an ID, we can do a direct GET request via UiTdatabank
        const baseUrl = 'https://io-test.uitdatabank.be/organizers/';
        const url = `${baseUrl}${id}`;
        const myHeaders = new Headers();
        myHeaders.append('Authorization', 'Bearer ' + accessToken);
        myHeaders.append('Accept', 'application/json');
        const requestOptions = {
            method: 'GET',
            headers: myHeaders,
        };
        const response = await fetch(url, requestOptions);
        const json = await response.json();
        if (response && response.ok && json) {
            if (isUitdatabankOrganizerResponse(json)) {
                if (json.name.nl) {
                    name = json.name.nl;
                }
                else if (Object.values(json.name).length > 0) {
                    name = Object.values(json.name)[0]; // use the first available language
                }
                const uitpasOrganizerResponse = new UitpasOrganizerResponse();
                uitpasOrganizerResponse.id = id;
                uitpasOrganizerResponse.name = name;
                const response = new UitpasOrganizersResponse();
                response.totalItems = 1;
                response.member = [uitpasOrganizerResponse];
                return response;
            }
        }
        // if something fails, we fall back to the search endpoint
    }

    const baseUrl = useTestEnv ? 'https://api-test.uitpas.be' : 'https://api.uitpas.be';
    const params = new URLSearchParams();
    params.append('name', name);
    params.append('limit', '200');
    const url = `${baseUrl}/organizers?${params.toString()}`;
    const myHeaders = new Headers();
    myHeaders.append('Authorization', 'Bearer ' + accessToken);
    myHeaders.append('Accept', 'application/json');
    const requestOptions = {
        method: 'GET',
        headers: myHeaders,
    };
    const response = await fetch(url, requestOptions).catch(() => {
        // Handle network errors
        throw new SimpleError({
            code: 'uitpas_unreachable_searching_organizers',
            message: `Network issue when searching for UiTPAS organizers`,
            human: $t(
                `We konden UiTPAS niet bereiken om UiTPAS-organisaties op te zoeken. Probeer het later opnieuw.`,
            ),
        });
    });
    if (!response.ok) {
        throw new SimpleError({
            code: 'unsuccessful_response_searching_uitpas_organizers',
            message: `Unsuccessful response when searching for UiTPAS organizers`,
            human: $t(`Er is een fout opgetreden bij het verbinden met UiTPAS. Probeer het later opnieuw.`),
        });
    }
    const json = await response.json().catch(() => {
        // Handle JSON parsing errors
        throw new SimpleError({
            code: 'invalid_json_searching_uitpas_organizers',
            message: `Invalid json when searching for UiTPAS organizers`,
            human: $t(
                `Er is een fout opgetreden bij het communiceren met UiTPAS. Probeer het later opnieuw.`,
            ),
        });
    });

    assertIsOrganizersResponse(json);
    const organizersResponse = new UitpasOrganizersResponse();
    organizersResponse.totalItems = json.totalItems;
    organizersResponse.member = json.member.map((member) => {
        const organizer = new UitpasOrganizerResponse();
        organizer.id = member.id;
        organizer.name = member.name;
        return organizer;
    });
    return organizersResponse;
}
