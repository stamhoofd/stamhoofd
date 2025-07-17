import { UitpasOrganizerResponse, UitpasOrganizersResponse } from "@stamhoofd/structures";
import { UitpasTokenRepository } from "../../helpers/UitpasTokenRepository";
import { SimpleError } from "@simonbackx/simple-errors";

type OrganizersResponse = {
    totalItems: number;
    member: Array<{
        id: string;
        name: string;
    }>;
}

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

export async function searchUitpasOrganizers(access_token: string, name: string): Promise<UitpasOrganizersResponse> {
        // uses platform credentials
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-organizers
        if (name === '') {
            throw new SimpleError({
                code: 'empty_uitpas_organizer_name',
                message: `Empty name when searching for UiTPAS organizers`,
                human: $t(`Je moet een naam opgeven om UiTPAS-organisaties te zoeken.`),
            });
        }
        const baseUrl = 'https://api-test.uitpas.be/organizers';
        const params = new URLSearchParams()
        params.append('name', name);
        params.append('limit', '200');
        const url = `${baseUrl}?${params.toString()}`;
        const myHeaders = new Headers();
        myHeaders.append('Authorization', 'Bearer ' + access_token);
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
