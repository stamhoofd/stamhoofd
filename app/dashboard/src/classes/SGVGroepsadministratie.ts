import { Toast } from '@stamhoofd/components';
import { Server, Request, RequestMiddleware, RequestResult } from '@simonbackx/simple-networking';

class SGVGroepsadministratieStatic implements RequestMiddleware {
    token: {accessToken: string; refreshToken: string} | null = null // null to keep reactive
    clientId = "groep-O2209G-Prins-Boudewijn-Wetteren"
    redirectUri = "https://stamhoofd.be"

    get hasToken() {
        return !!this.token
    }

    /**
     * Redirect to the OAuth flow to get a new token
     */
    startOAuth() {
        
        
        const state = new Buffer(crypto.getRandomValues(new Uint32Array(16))).toString('base64');

        // Save state here

        // https://login.scoutsengidsenvlaanderen.be/auth/realms/scouts/.well-known/openid-configuration

        const url = "https://login.scoutsengidsenvlaanderen.be/auth/realms/scouts/protocol/openid-connect/auth?client_id="+encodeURIComponent(this.clientId)+"&redirect_uri="+this.redirectUri+"&state="+state+"&response_mode=query&response_type=code&scope=openid"
        window.location.href = url;
    }

     async getToken(code: string) {
        const toast = new Toast("Inloggen...", "spinner").setHide(null).show()

        try {
            const formData = new FormData()
            formData.append("client_id", this.clientId)
            formData.append("code", code)
            formData.append("grant_type", "authorization_code")

            const response: RequestResult<any> = await this.loginServer.request({
                method: "POST",
                path: "/auth/realms/scouts/protocol/openid-connect/token",
                body: {
                    client_id: this.clientId,
                    code: code,
                    grant_type: "authorization_code",
                    redirect_uri: this.redirectUri
                },
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            })

            console.log(response)

            this.token = {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token
            };

            // Maybe: redirect_uri
            toast.hide()
            new Toast("Ingelogd bij groepsadministratie", "success green").show()
        } catch (e) {
            console.error(e)
            toast.hide()
            new Toast("Inloggen mislukt", "error red").show()
        }
    }

    async downloadTest() {
        try {
            const response = await this.authenticatedServer.request({
                method: "GET",
                path: "/ledenlijst",
                query: {
                    aantal: 100,
                    offset: 0
                }
            })

            console.log(response)
            new Toast("Test gelukt", "success green").show()
        } catch (e) {
            console.error(e)
            new Toast("Test mislukt", "error red").show()
        }
        
    }


    checkUrl(): boolean | null {
        const path = window.location.pathname;
        const parts = path.substring(1).split("/");

        if (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'sgv') {
            // Support for both fragment and query string codes.

            const parsedHash = new URLSearchParams(
                window.location.hash.substr(1) // skip the first char (#)
            );
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code') ?? parsedHash.get("code");
            const state = urlParams.get('state') ?? parsedHash.get("state");

            if (code && state) {
                this.getToken(code);
                return true;
            } else {
                new Toast("Inloggen bij groepsadministratie mislukt", "error red").show()
            }
            return false;
        } else {
            return null;
        }
    }

    get loginServer() {
        return new Server("https://login.scoutsengidsenvlaanderen.be")
    }

    get server() {
        return new Server("https://groepsadmin.scoutsengidsenvlaanderen.be/groepsadmin/rest-ga")
    }

    get authenticatedServer() {
        const server = this.server
        server.middlewares.push(this)
        return server
    }

     // -- Implementation for requestMiddleware ----

    async onBeforeRequest(request: Request<any>): Promise<void> {
        if (!this.token) {
            // Euhm? The user is not signed in!
            throw new Error("Could not authenticate request without token")
        }

        request.headers["Authorization"] = "Bearer " + this.token.accessToken;
    }

}


export const SGVGroepsadministratie = new SGVGroepsadministratieStatic() 