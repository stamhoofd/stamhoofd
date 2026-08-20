import { SessionClientType } from '@stamhoofd/structures';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Kept short: this is the window in which a leaked access token is still worth something.
 */
export const ACCESS_TOKEN_DURATION = 15 * MINUTE;
export const SSO_HANDOFF_TOKEN_DURATION = 5 * MINUTE;

export type SessionType = 'sso' | 'platformAdmin' | 'admin' | 'user';

export type SessionDurations = {
    /**
     * Maximum length of the session, counted from the login. Renewing never extends it, so
     * this is when the user has to sign in again however active they were.
     */
    session: number | null;

    /**
     * How long the session may go unused before it ends. Every renewal restarts it.
     */
    refreshToken: number;
};

/**
 * How long a session lives, per kind of session and client.
 *
 * Sessions in a browser are the shortest: it is not a place we can trust to keep a token
 * safe (shared computers, extensions, synced profiles), while the native app keeps its
 * tokens in the secure storage of the device and renews them in the background. Sessions
 * that give access to the data of other people are shorter than those of a member, and an
 * SSO session is the shortest of all: access is granted and taken away at the identity
 * provider, so we go back to it often.
 */
export const SESSION_DURATIONS: Record<SessionType, Record<SessionClientType, SessionDurations>> = {
    sso: {
        [SessionClientType.Browser]: { session: 12 * HOUR, refreshToken: 3 * HOUR },
        [SessionClientType.iOS]: { session: 7 * DAY, refreshToken: 36 * HOUR },
        [SessionClientType.Android]: { session: 7 * DAY, refreshToken: 36 * HOUR },
    },
    platformAdmin: {
        [SessionClientType.Browser]: { session: 12 * HOUR, refreshToken: 3 * HOUR },
        [SessionClientType.iOS]: { session: 7 * DAY, refreshToken: 36 * HOUR },
        [SessionClientType.Android]: { session: 7 * DAY, refreshToken: 36 * HOUR },
    },
    admin: {
        [SessionClientType.Browser]: { session: 180 * DAY, refreshToken: 90 * DAY },
        [SessionClientType.iOS]: { session: null, refreshToken: 90 * DAY },
        [SessionClientType.Android]: { session: null, refreshToken: 90 * DAY },
    },
    user: {
        [SessionClientType.Browser]: { session: 180 * DAY, refreshToken: 180 * DAY },
        [SessionClientType.iOS]: { session: null, refreshToken: 180 * DAY },
        [SessionClientType.Android]: { session: null, refreshToken: 180 * DAY },
    },
};
