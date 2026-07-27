import type { CliContext } from '../context/create-context.js';
import type { RouteManifest, RouteManifestInput } from './manifest-store.js';
import { listActiveRouteManifests, pruneStaleRouteManifests, removeRouteManifest, writeRouteManifest } from './manifest-store.js';
import { findBusyPorts } from './port-probe.js';

export type RouteManifestConflict = {
    /** The manifest that already claims these ports. */
    manifest: RouteManifest;
    ports: number[];
};

export type ReserveRouteManifestOptions = {
    /**
     * Builds the manifest for attempt `attempt` (0-based), each one claiming a different port
     * range. Return undefined once no range is left to try.
     */
    buildManifest: (attempt: number) => RouteManifestInput | undefined;
};

/**
 * How long to wait between writing a manifest and verifying it again. A process that ran its own
 * check just before our file landed still has to write its manifest; the pause makes it very
 * likely we see that write, so exactly one of the two backs off (see `losesRaceAgainst`).
 */
const settleMs = 250;

/**
 * The active manifests whose reserved ports overlap the ports of `candidate`. Manifests with the
 * same name are ignored: that one is the candidate itself (a previous attempt of this same run).
 */
export async function findRouteManifestConflicts(context: CliContext, candidate: RouteManifestInput): Promise<RouteManifestConflict[]> {
    const wanted = new Set(candidate.reservedPorts ?? []);
    if (wanted.size === 0) {
        return [];
    }

    const manifests = await listActiveRouteManifests(context);
    return manifests
        .filter(manifest => manifest.name !== candidate.name)
        .map(manifest => ({ manifest, ports: (manifest.reservedPorts ?? []).filter(port => wanted.has(port)) }))
        .filter(conflict => conflict.ports.length > 0);
}

/**
 * Claim a port range for this process by writing a route manifest for it.
 *
 * Ranges are tried in the order `buildManifest` produces them, and a range is only claimed when
 * both checks pass: no active manifest reserves any of its ports, and every port can actually be
 * bound right now (which also covers processes that never wrote a manifest). The manifest is
 * written first and verified afterwards, so two processes that pick the same free range at the
 * same time do not both keep it: the one that started later removes its manifest and moves on.
 */
export async function reserveRouteManifest(context: CliContext, options: ReserveRouteManifestOptions): Promise<RouteManifest> {
    const blocked: string[] = [];

    // Manifests of crashed runs would keep their ports claimed forever.
    await pruneStaleRouteManifests(context);

    for (let attempt = 0; ; attempt += 1) {
        const candidate = options.buildManifest(attempt);
        if (!candidate) {
            throw new Error(`Could not reserve a free port range${blocked.length === 0 ? '' : `. Tried ${blocked.length} ranges: ${describeBlocked(blocked)}`}`);
        }

        const blockedBy = await describeBlockers(context, candidate);
        if (blockedBy) {
            blocked.push(blockedBy);
            continue;
        }

        const written = await writeRouteManifest(context, candidate);
        await new Promise(resolve => setTimeout(resolve, settleMs));

        const lostAgainst = (await findRouteManifestConflicts(context, candidate))
            .filter(conflict => losesRaceAgainst(candidate, conflict.manifest));

        if (lostAgainst.length === 0) {
            return written;
        }

        // Another process claimed (part of) this range at the same time and started first.
        await removeRouteManifest(context, candidate.name);
        blocked.push(`${describePorts(lostAgainst.flatMap(conflict => conflict.ports))} claimed by ${lostAgainst.map(conflict => conflict.manifest.name).join(', ')}`);
    }
}

async function describeBlockers(context: CliContext, candidate: RouteManifestInput): Promise<string | undefined> {
    const conflicts = await findRouteManifestConflicts(context, candidate);
    if (conflicts.length > 0) {
        return `${describePorts(conflicts.flatMap(conflict => conflict.ports))} reserved by ${conflicts.map(conflict => conflict.manifest.name).join(', ')}`;
    }

    const busy = await findBusyPorts(candidate.reservedPorts ?? []);
    if (busy.length > 0) {
        return `${describePorts(busy)} already in use`;
    }

    return undefined;
}

/**
 * Deterministic tiebreak for two manifests that claim the same ports: the one that started first
 * keeps the range, and equal timestamps fall back to the name so both processes reach the same
 * conclusion. The later one gives up, whichever side is asking.
 */
function losesRaceAgainst(candidate: RouteManifestInput, other: RouteManifest): boolean {
    const candidateStart = Date.parse(candidate.startedAt);
    const otherStart = Date.parse(other.startedAt);

    if (candidateStart !== otherStart) {
        return candidateStart > otherStart;
    }
    return candidate.name > other.name;
}

/**
 * The reasons of the first few ranges: a run reserves dozens of ports, so listing every range in
 * full turns the error into a wall of numbers.
 */
function describeBlocked(blocked: string[]): string {
    const shown = blocked.slice(0, 3);
    return `${shown.join('; ')}${blocked.length > shown.length ? `; ...` : ''}`;
}

function describePorts(ports: number[]): string {
    const unique = [...new Set(ports)].sort((a, b) => a - b);
    const shown = unique.slice(0, 4);
    return `port${unique.length === 1 ? '' : 's'} ${shown.join(', ')}${unique.length > shown.length ? `, ... (${unique.length} total)` : ''}`;
}
