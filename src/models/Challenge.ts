import { column, Database, ManyToOneRelation,Model } from "@simonbackx/simple-database";
import { SimpleError } from "@simonbackx/simple-errors"
import { KeyConstantsHelper, SensitivityLevel } from '@stamhoofd/crypto';
import { KeyConstants } from '@stamhoofd/structures';
import crypto from "crypto";

import { User } from "./User";

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

export type GeneratedChallenge = Challenge & { challenge: string }

/**
 * Holds the challenges for a given email. User should not exist, since that would allow user enumeration attacks
 */
export class Challenge extends Model {
    static table = "challenges";

    @column({ primary: true, type: "integer" })
    id: number;

    @column({ type: "string" })
    organizationId: string;

    // Columns
    @column({ type: "string" })
    email: string;

    @column({ type: "string", nullable: true })
    challenge: string | null = null;

    /**
     * For when no user is found for this email, these key constants are used instead so they remain the same and do not allow any user enumeration attack
     */
    @column({ type: "json", decoder: KeyConstants })
    authSignKeyConstants: KeyConstants

    @column({ type: "integer" })
    tries = 0;

    @column({ type: "datetime" })
    expiresAt: Date;

    /**
     * createdAt behaves more like createdAt for Challenge. Since every save is considered to have a new challenge
     */
    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    static async getFor(organizationId: string, email: string): Promise<Challenge | undefined> {
        // todo: make this constant time to avoid complex timing attacks (especially when under load)
        // Do we already have a challenge for this email?
        const challenges = await this.where({ email, organizationId }, { limit: 1 })

       if (challenges.length == 1) {
           const challenge = challenges[0]
           if (challenge.expiresAt < new Date()) {
               return
           }
           return challenge
       }

        return
    }

    static async createFor(organizationId: string, email: string): Promise<GeneratedChallenge> {
        // todo: make this constant time to avoid complex timing attacks (especially when under load)
        // Do we already have a challenge for this email?
        const challenges = await this.where({ email, organizationId }, { limit: 1 })

        // Always query users
        const user = await User.getForAuthentication(organizationId, email)

        let challenge: Challenge
        if (challenges.length == 0) {
            challenge = new Challenge()
            challenge.organizationId = organizationId

            if (!user) {
                // Make sure we still generate some random admins, but as slight minority (better to have more admins here than IRL)
                challenge.authSignKeyConstants = await KeyConstantsHelper.create(Math.random() < 0.2 ? SensitivityLevel.Admin : SensitivityLevel.User)
            }
        } else {
            challenge = challenges[0]
        }

        if (user) {
            challenge.authSignKeyConstants = user.getAuthSignKeyConstants()
        } else {
            // todo: create new key constants after X period (e.g. 1 year ± random offset )
        }

        // Incraese tries
        challenge.tries++;

        // Check if need to prevent creating a new challenge
        if (challenge.tries >= 3) {
            // Already had at least two generated challenges...

            // Already generated two challenges after each other
            // Now limit to once every 5 seconds
            const isTesting = process.env.JEST_WORKER_ID !== undefined

            if (challenge.createdAt > new Date(new Date().getTime() - (isTesting ? 1000 : 1000 * 5))) {
                // Lockout for 1 hour
                throw new SimpleError({
                    code: "too_many_requests",
                    message: "Too many challenges generated",
                    human: "Opgelet, je kan niet zo snel na elkaar proberen in te loggen.",
                    statusCode: 429
                })
            }
        }

        if (challenge.tries >= 10 && challenge.createdAt > new Date(new Date().getTime() - 1000 * 60 * 60)) {
            // Already had at least 9 generated challenges...
            // Lockout for 1 hour
            throw new SimpleError({
                code: "too_many_requests",
                message: "Too many challenges generated. Please retry in an hour.",
                human: "Er zijn te veel foutieve inlogpogingen vastgesteld, probeer het opnieuw binnen één uur.",
                statusCode: 429
            })
        }

        // Create a new challenge
        challenge.challenge = (await randomBytes(128)).toString("base64")
        challenge.email = email

        // Expire in one minute
        challenge.expiresAt = new Date(new Date().getTime() + 1000 * 60)

        await challenge.save()
        
        return challenge as GeneratedChallenge
    }
}
