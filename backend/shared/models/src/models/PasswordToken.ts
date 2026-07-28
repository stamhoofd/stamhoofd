import type { ManyToOneRelation } from '@simonbackx/simple-database';
import { column, Database } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import basex from 'base-x';
import crypto from 'crypto';

import { User } from './User.js';
import { SimpleError } from '@simonbackx/simple-errors';
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const bs58 = basex(ALPHABET);

export type PasswordTokenWithUser = PasswordToken & { user: User };

async function randomBytes(size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err: Error | null, buf: Buffer) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(buf);
        });
    });
}

export class PasswordToken extends QueryableModel {
    static table = 'password_tokens';

    // Columns
    @column({ primary: true, type: 'string' })
    token: string;

    @column({ type: 'datetime' })
    validUntil: Date;

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

    @column({ type: 'string' })
    userId: string;

    static user: ManyToOneRelation<'user', User>;

    isExpired(): boolean {
        return this.validUntil < new Date();
    }

    /**
     * Get a token
     * @param token
     * @param ignoreExpireDate: do not return if it is expired
     */
    static async getToken(token: string, ignoreExpireDate = false): Promise<PasswordTokenWithUser | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()}, ${User.getDefaultSelect('user')}  FROM ${
                this.table
            } ${PasswordToken.user.joinQuery(this.table, 'user')} WHERE ${this.primary.name} = ? LIMIT 1 `,
            [token],
        );

        if (rows.length == 0) {
            return undefined;
        }

        const passwordToken = this.fromRow(rows[0][this.table]);

        if (!passwordToken) {
            return undefined;
        }

        if (!ignoreExpireDate && passwordToken.isExpired()) {
            // If the refresh token is invalid, do not return it
            return undefined;
        }

        const user = User.fromRow(rows[0]['user']) || null;

        if (!user) {
            console.error('Password token without a valid user!');
            return undefined;
        }

        return passwordToken.setRelation(PasswordToken.user, user);
    }

    /***
     * Create a token without saving it
     */
    static async createToken<U extends User>(user: U, validUntil?: Date): Promise<PasswordTokenWithUser> {
        if (user.isSystemUser) {
            throw new SimpleError({
                code: 'internal_error',
                message: 'Cannot create password token for system user',
                statusCode: 500,
            });
        }

        const token = new PasswordToken().setRelation(PasswordToken.user, user);

        if (validUntil) {
            token.validUntil = new Date(validUntil);
        } else {
            token.validUntil = new Date();
            token.validUntil.setTime(token.validUntil.getTime() + 3 * 3600 * 1000);
        }
        token.validUntil.setMilliseconds(0);
        token.token = bs58.encode(await randomBytes(100)).toLowerCase();
        await token.save();
        return token;
    }

    static async clearFor(userId: string) {
        const query = `DELETE from ${this.table} where userId = ?`;
        await Database.delete(query, [userId]);
    }
}
