import { Data } from '@stamhoofd-common/encoding';

export class Token {
    accessToken: string;
    refreshToken: string;
    accessTokenValidUntil: Date;

    constructor(data: { accessToken: string; refreshToken: string; accessTokenValidUntil: Date}) {
        this.accessToken = data.accessToken
        this.refreshToken = data.refreshToken
    }

    static decode(data: Data): Token {
        return new Token({
            accessToken: data.field("access_token").string,
            refreshToken: data.field("refresh_token").string,
            accessTokenValidUntil: new Date(Date.now() + data.field("expires_in").number * 1000 - 30 * 1000),
        });            
    }

    /**
     * Persist this token in a keychain, or other method that is available
     */
    async storeInKeyChain() {
        if (!process.env.IS_ELECTRON) {
            return;
        }
        const keytar = await import("keytar")
        await keytar.setPassword("be.stamhoofd.account.token", "todo", this.refreshToken);
    }

    static async restoreFromKeyChain(): Promise<Token | undefined> {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        if (!process.env.IS_ELECTRON) {
            return;
        }

        const keytar = await import("keytar")
        const credentials = await keytar.findCredentials("be.stamhoofd.account.token")
        if (credentials.length > 0) {
            return new Token({
                accessToken: "",
                refreshToken: credentials[0].password,
                accessTokenValidUntil: new Date(Date.now() - 1000)
            })
        }
    }
}