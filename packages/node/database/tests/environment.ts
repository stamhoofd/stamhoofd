/**
 * Points the Database connection at the test database. `stam test` provides DB_PORT.
 */
export function setTestDatabaseEnvironment() {
    process.env.DB_DATABASE = 'stamhoofd-tests';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PASS = 'root';
    process.env.DB_USER = 'root';
    process.env.DB_CHARSET = 'utf8mb4_0900_ai_ci';
    process.env.DB_MULTIPLE_STATEMENTS = 'true';
}
