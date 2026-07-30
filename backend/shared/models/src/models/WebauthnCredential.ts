import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { v4 as uuidv4 } from 'uuid';

/**
 * A single passkey / WebAuthn credential enrolled by a user. A user may have multiple.
 * `credentialId` is unique and indexed so credentials can be looked up directly (needed
 * for future usernameless/passwordless login).
 */
export class WebauthnCredential extends QueryableModel {
    static table = 'webauthn_credentials';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    userId: string;

    /**
     * Base64url-encoded credential id, as returned by the authenticator.
     */
    @column({ type: 'string' })
    credentialId: string;

    /**
     * The Relying Party ID this credential was created for.
     *
     * A passkey is bound to one domain: the authenticator will not release it to any other
     * one, and verification has to check it against the RP ID it was made for. Storing it
     * per credential is what keeps existing passkeys valid if the platform ever serves more
     * than one authentication domain, or moves to a different one.
     *
     * NULL for credentials created before this was stored: those all used the platform RP
     * ID, which the helper falls back to.
     */
    @column({ type: 'string', nullable: true })
    rpId: string | null = null;

    /**
     * Base64url-encoded COSE public key.
     */
    @column({ type: 'string' })
    publicKey: string;

    @column({ type: 'integer' })
    counter = 0;

    /**
     * JSON-encoded array of AuthenticatorTransport values (or null).
     */
    @column({ type: 'string', nullable: true })
    transports: string | null = null;

    /**
     * The WebAuthn backup state (BS) flag: whether this credential is currently backed up.
     */
    @column({ type: 'boolean' })
    backedUp = false;

    /**
     * The WebAuthn backup eligibility (BE) flag: whether this credential may ever be backed
     * up (a synced passkey) or is bound to one device.
     *
     * Stored next to `backedUp` because it cannot be derived from it, and a different
     * library would expect both halves of the pair.
     */
    @column({ type: 'boolean' })
    backupEligible = false;

    @column({ type: 'string' })
    name = '';

    @column({ type: 'string', nullable: true })
    providerId: string | null = null;

    @column({ type: 'string', nullable: true })
    providerName: string | null = null;

    @column({ type: 'datetime', nullable: true })
    lastUsedAt: Date | null = null;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    get transportsArray(): string[] | undefined {
        if (!this.transports) {
            return undefined;
        }
        try {
            const parsed = JSON.parse(this.transports);
            return Array.isArray(parsed) ? parsed : undefined;
        } catch (e) {
            return undefined;
        }
    }

    static async getForUser(userId: string): Promise<WebauthnCredential[]> {
        return await this.select().where('userId', userId).fetch();
    }

    static async getByCredentialId(credentialId: string): Promise<WebauthnCredential | undefined> {
        if (!credentialId) {
            return undefined;
        }
        return (await this.select().where('credentialId', credentialId).first(false)) ?? undefined;
    }
}
