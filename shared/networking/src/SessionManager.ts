import { Session } from './Session';

/**
 * The SessionManager manages the storage of Sessions for different organizations. You can request the session for a given organization.
 * If a token is present, it will automatically allow the user to be kept logged in.
 * You can also request the available sessions, so you can hint the user in which organizations he is already signed in.
 */
export class SessionManager {

    getSessionFor(organization: number) {
        return new Session()
    }

}