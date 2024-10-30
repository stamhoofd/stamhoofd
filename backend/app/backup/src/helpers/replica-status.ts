import { Database } from '@simonbackx/simple-database';

export async function checkReplicaStatus() {
    const [rows] = await Database.select(`SHOW REPLICA STATUS`);

    if (rows.length === 0) {
        throw new Error('No replica status found');
    }

    const row = rows[0]['namespace'];

    // Check Replica_SQL_Running = Yes
    if (row['Replica_SQL_Running'] !== 'Yes') {
        throw new Error('Replica_SQL_Running is not Yes');
    }

    // Check Replica_IO_Running = Yes
    if (row['Replica_IO_Running'] !== 'Yes') {
        throw new Error('Replica_IO_Running is not Yes');
    }

    // Check Last_IO_Error is empty
    if (row['Last_IO_Error'] !== '') {
        throw new Error('Last_IO_Error is not empty: ' + row['Last_IO_Error']);
    }

    // Check Last_SQL_Error is empty
    if (row['Last_SQL_Error'] !== '') {
        throw new Error('Last_SQL_Error is not empty: ' + row['Last_SQL_Error']);
    }

    if (typeof row['Seconds_Behind_Source'] !== 'string') {
        throw new Error('Seconds_Behind_Source is not a string');
    }

    // Seconds_Behind_Source is not super accurate, so we add a large offset
    if (parseInt(row['Seconds_Behind_Source']) > 60 * 5) {
        throw new Error('Seconds_Behind_Source is greater than 5 minutes');
    }
}
