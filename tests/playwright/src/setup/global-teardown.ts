export default async function globalTeardown() {
    // Shared services are owned by the CLI. Caddy config is restored by `stam test e2e` after Playwright exits.
}
