import { ObjectData } from '@stamhoofd-common/encoding';
import ArrayDecoder from '@stamhoofd-common/encoding/src/structs/ArrayDecoder';
import { Organization } from '@stamhoofd-frontend/models';

import { AsyncStorage } from './AsyncStorage';
import { ManagedToken } from './ManagedToken';
import { Session } from './Session';
import { User } from './User';

class SessionManager {
    /// Current session in use
    currentSession?: Session

    /**
     * List all the available sessions
     */
    async getSessions(): Promise<Session[]> {
        const sessions = await AsyncStorage.getItem("sessions");

        if (!sessions) {
            console.warn("Sessions not found")
            return []
        }
        console.log(sessions)
        try {
            const data = new ObjectData(sessions)

            const allSessions: Session[] = []
            for (const sessionData of data.decode(ArrayDecoder)) {
                const user = sessionData.field("user").decode(User)
                const organization = sessionData.field("organization").decode(Organization)
                const token = await ManagedToken.restoreFromKeyChain(organization.uri + ";" + user.email)
                if (!token) {
                    console.warn("Token for user "+user.email+" missing in keychain")
                    continue;
                }
                const session = new Session(token, user, organization)
                allSessions.push(session)

            }
            console.log(allSessions)
            return allSessions

        } catch (e) {
            console.error(e)
            return []
        }
    }

    async setSessions(sessions: Session[]) {
        console.warn("Saving sessions")
        const data: any = [];
        for (const session of sessions) {
            data.push({
                user: session.user.encode(),
                organization: session.organization.encode(),
            });
            // If not yet saved...
            await session.token.storeInKeyChain();
        }

        await AsyncStorage.setItem("sessions", data)
    }

    async getLastSession(): Promise<Session | undefined> {
        if (this.currentSession) {
            return this.currentSession
        }
        const sessions = await this.getSessions()
        if (sessions.length == 0) {
            return
        }
        // Todo: check timestamp or something else
        return sessions[0]
    }

    setCurrent(session: Session) {
        this.currentSession = session
    }

    async saveSession(session: Session) {
        const sessions = await this.getSessions()
        for (const [index, s] of sessions.entries()) {
            if (s.user.email == session.user.email && s.organization.uri == session.organization.uri) {
                // Already found
                sessions[index] = session
                await this.setSessions(sessions)
                return;
            }
        }
        sessions.unshift(session)
        await this.setSessions(sessions)
    }

    async hasSession(): Promise<boolean> {
        return !!await this.getLastSession()
    }
}

export default new SessionManager();