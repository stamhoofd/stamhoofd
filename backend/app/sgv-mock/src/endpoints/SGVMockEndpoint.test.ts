import { Request, TestServer } from "@simonbackx/simple-endpoints";
import {
    defaultSGVGroupNumber,
    SGV_FUNCTION_PATH,
    SGV_GROUP_PATH,
    SGV_LOGIN_AUTHORIZE_PATH,
    SGV_LOGIN_TOKEN_PATH,
    SGV_MEMBER_LIST_FILTER_PATH,
    SGV_MEMBER_LIST_PATH,
    SGV_MEMBER_PATH,
    SGV_PROFILE_PATH,
    SGV_SEARCH_SIMILAR_PATH,
    sgvMemberPath,
} from "@stamhoofd/sgv";
import { SGVMockEndpoint } from "./SGVMockEndpoint.js";
import { sgvMockState } from "../state/mock-state.js";

describe("Endpoint.SGVMock", () => {
    const endpoint = new SGVMockEndpoint();
    const testServer = new TestServer();

    beforeEach(() => {
        sgvMockState.reset();
    });

    it("shows a debug page at the root path", async () => {
        const response = await testServer.test(
            endpoint,
            Request.get({ path: "/" }),
        );

        expect(response.status).toBe(200);
        expect(response.headers).toEqual(
            expect.objectContaining({
                "Content-Type": "text/html; charset=utf-8",
            }),
        );
        expect(response.body).toContain("SGV mock data");
        expect(response.body).toContain("Existing");
        expect(response.body).toContain("member-1");
    });

    it("returns OAuth tokens", async () => {
        const response = await testServer.test(
            endpoint,
            Request.post({ path: SGV_LOGIN_TOKEN_PATH }),
        );

        expect(response.status).toBe(200);
        expect(body(response)).toMatchObject({
            access_token: "sgv-mock-access-token",
            refresh_token: "sgv-mock-refresh-token",
            expires_in: 3600,
        });
    });

    it("redirects OAuth authorize requests to the callback URL", async () => {
        const response = await testServer.test(
            endpoint,
            Request.get({
                path: SGV_LOGIN_AUTHORIZE_PATH,
                query: {
                    client_id: "client-id",
                    redirect_uri: "https://example.com/oauth/sgv",
                    state: "state-value",
                    response_type: "code",
                    scope: "openid",
                },
            }),
        );

        expect(response.status).toBe(302);
        expect(response.headers.Location).toBe(
            "https://example.com/oauth/sgv?code=sgv-mock&state=state-value",
        );
    });

    it("preserves callback query parameters and URL-encodes OAuth state", async () => {
        const response = await testServer.test(
            endpoint,
            Request.get({
                path: SGV_LOGIN_AUTHORIZE_PATH,
                query: {
                    client_id: "client-id",
                    redirect_uri:
                        "https://example.com/oauth/sgv?existing=value",
                    state: "state value&with=symbols",
                    response_type: "code",
                    scope: "openid",
                },
            }),
        );

        expect(response.status).toBe(302);
        expect(response.headers.Location).toBe(
            "https://example.com/oauth/sgv?existing=value&code=sgv-mock&state=state+value%26with%3Dsymbols",
        );
    });

    it("rejects OAuth authorize requests with missing parameters", async () => {
        await expect(
            testServer.test(
                endpoint,
                Request.get({ path: SGV_LOGIN_AUTHORIZE_PATH }),
            ),
        ).rejects.toThrow(/Missing OAuth parameter: client_id/);
    });

    it("accepts authorization-code and refresh-token exchange request bodies", async () => {
        const authorizationCodeResponse = await testServer.test(
            endpoint,
            Request.post({
                path: SGV_LOGIN_TOKEN_PATH,
                body: {
                    client_id: "client-id",
                    code: "sgv-mock",
                    grant_type: "authorization_code",
                    redirect_uri: "https://example.com/oauth/sgv",
                },
            }),
        );
        const refreshTokenResponse = await testServer.test(
            endpoint,
            Request.post({
                path: SGV_LOGIN_TOKEN_PATH,
                body: {
                    client_id: "client-id",
                    refresh_token: "sgv-mock-refresh-token",
                    grant_type: "refresh_token",
                    redirect_uri: "https://example.com/oauth/sgv",
                },
            }),
        );

        expect(body(authorizationCodeResponse)).toMatchObject({
            access_token: "sgv-mock-access-token",
        });
        expect(body(refreshTokenResponse)).toMatchObject({
            refresh_token: "sgv-mock-refresh-token",
        });
    });

    it("returns the configured group, functions and profile", async () => {
        const groupResponse = await testServer.test(
            endpoint,
            Request.get({ path: SGV_GROUP_PATH }),
        );
        const functionResponse = await testServer.test(
            endpoint,
            Request.get({
                path: SGV_FUNCTION_PATH,
                query: { groep: defaultSGVGroupNumber },
            }),
        );
        const profileResponse = await testServer.test(
            endpoint,
            Request.get({ path: SGV_PROFILE_PATH }),
        );

        expect(body(groupResponse)).toMatchObject({
            groepen: [{ groepsnummer: defaultSGVGroupNumber }],
        });
        expect(
            body(functionResponse).functies.map((f: any) => f.code),
        ).toContain("JIN");
        expect(body(profileResponse)).toMatchObject({
            functies: [{ groep: defaultSGVGroupNumber, code: "VGA" }],
        });
    });

    it("creates group functions", async () => {
        const response = await testServer.test(
            endpoint,
            Request.post({
                path: SGV_FUNCTION_PATH,
                body: {
                    beschrijving: "Beheerd in Stamhoofd",
                    groepen: [defaultSGVGroupNumber],
                },
            }),
        );

        expect(response.status).toBe(201);
        expect(body(response)).toMatchObject({
            beschrijving: "Beheerd in Stamhoofd",
        });
        expect(sgvMockState.functions).toHaveLength(7);
    });

    it("stores the current ledenlijst filter and returns paginated member summaries", async () => {
        await testServer.test(
            endpoint,
            Request.patch({
                path: SGV_MEMBER_LIST_FILTER_PATH,
                body: {
                    criteria: {
                        groepen: [defaultSGVGroupNumber],
                        oudleden: false,
                    },
                    type: "lid",
                },
            }),
        );

        const response = await testServer.test(
            endpoint,
            Request.get({
                path: SGV_MEMBER_LIST_PATH,
                query: { aantal: 1, offset: 0 },
            }),
        );

        expect(sgvMockState.currentFilter).toMatchObject({
            criteria: { groepen: [defaultSGVGroupNumber] },
        });
        expect(body(response)).toMatchObject({
            aantal: 1,
            offset: 0,
            totaal: 1,
            leden: [{ id: "member-1" }],
        });
        expect(
            body(response).leden[0].waarden[
                "be.vvksm.groepsadmin.model.column.GeboorteDatumColumn"
            ],
        ).toBe("01/02/2000");
    });

    it("searches similar members", async () => {
        const response = await testServer.test(
            endpoint,
            Request.get({
                path: SGV_SEARCH_SIMILAR_PATH,
                query: { voornaam: "Existing", achternaam: "Member" },
            }),
        );

        expect(body(response)).toMatchObject({
            leden: [
                {
                    id: "member-1",
                    voornaam: "Existing",
                    achternaam: "Member",
                    geboortedatum: "2000-02-01",
                },
            ],
        });
    });

    it("fetches, creates and patches members", async () => {
        const existing = await testServer.test(
            endpoint,
            Request.get({ path: sgvMemberPath("member-1") }),
        );
        expect(body(existing)).toMatchObject({
            id: "member-1",
            vgagegevens: { voornaam: "Existing" },
        });

        const created = await testServer.test(
            endpoint,
            Request.post({
                path: `${SGV_MEMBER_PATH}?bevestig=true`,
                body: {
                    vgagegevens: {
                        voornaam: "New",
                        achternaam: "Member",
                        geboortedatum: "2010-03-04",
                    },
                    adressen: [],
                    contacten: [],
                    functies: [],
                },
            }),
        );
        expect(created.status).toBe(201);
        expect(body(created)).toMatchObject({
            id: "member-2",
            vgagegevens: { voornaam: "New" },
        });

        const patched = await testServer.test(
            endpoint,
            Request.patch({
                path: `${sgvMemberPath("member-2")}?bevestig=true`,
                body: { vgagegevens: { voornaam: "Updated" } },
            }),
        );
        expect(body(patched)).toMatchObject({
            id: "member-2",
            vgagegevens: { voornaam: "Updated", achternaam: "Member" },
        });
    });

    it("returns created members in later list pages and the debug page", async () => {
        await testServer.test(
            endpoint,
            Request.post({
                path: `${SGV_MEMBER_PATH}?bevestig=true`,
                body: {
                    vgagegevens: {
                        voornaam: "Second",
                        achternaam: "Member",
                        geboortedatum: "2011-03-04",
                    },
                    adressen: [],
                    contacten: [],
                    functies: [],
                },
            }),
        );
        await testServer.test(
            endpoint,
            Request.post({
                path: `${SGV_MEMBER_PATH}?bevestig=true`,
                body: {
                    vgagegevens: {
                        voornaam: "Third",
                        achternaam: "Member",
                        geboortedatum: "2012-03-04",
                    },
                    adressen: [],
                    contacten: [],
                    functies: [],
                },
            }),
        );

        const page = await testServer.test(
            endpoint,
            Request.get({
                path: SGV_MEMBER_LIST_PATH,
                query: { aantal: 1, offset: 2 },
            }),
        );
        const debug = await testServer.test(
            endpoint,
            Request.get({ path: "/" }),
        );

        expect(body(page)).toMatchObject({
            aantal: 1,
            offset: 2,
            totaal: 3,
            leden: [{ id: "member-3" }],
        });
        expect(debug.body).toContain("Third");
        expect(debug.body).toContain("member-3");
    });

    it("can end member functions through patches", async () => {
        const patched = await testServer.test(
            endpoint,
            Request.patch({
                path: `${sgvMemberPath("member-1")}?bevestig=true`,
                body: {
                    functies: [
                        {
                            functie: "d5f75b320b812440010b812555c1039b",
                            groep: defaultSGVGroupNumber,
                            begin: "2020-01-01",
                            einde: "2026-01-01",
                        },
                    ],
                },
            }),
        );

        expect(body(patched).functies[0]).toMatchObject({
            functie: "d5f75b320b812440010b812555c1039b",
            einde: "2026-01-01",
        });
    });

    it("returns an error for unknown members", async () => {
        await expect(
            testServer.test(
                endpoint,
                Request.get({ path: sgvMemberPath("missing") }),
            ),
        ).rejects.toThrow(/SGV member not found/);
    });
});

function body(response: { body: any }): any {
    return JSON.parse(response.body as string);
}
