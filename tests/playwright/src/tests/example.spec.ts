import { test } from '../setup/fixtures';

// test('has title', async ({ page }) => {
//   await page.goto('https://playwright.dev/');

//   // Expect a title "to contain" a substring.
//   await expect(page).toHaveTitle(/Playwright/);
// });

// test('get started link', async ({ page, backend }) => {
//   await page.goto('https://playwright.dev/');

//   // Click the get started link.
//   await page.getByRole('link', { name: 'Get started' }).click();

//   // Expects page to have a heading with the name of Installation.
//   await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
// });

// test('test test', async ({ page }, testInfo) => {
//       await page.goto('https://playwright.dev/');

// //   // Expect a title "to contain" a substring.
//   await expect(page).toHaveTitle(/Playwright/);
//     expect(1).toBe(1);
    
// })

test('test dashboard', async ({ page, backend }) => {
  await page.goto(backend.urls.dashboard);

//   await page.getByRole('h1', { name: 'Dashboard' }).click();
//   // Click the get started link.
//   await page.getByRole('link', { name: 'Get started' }).click();

//   // Expects page to have a heading with the name of Installation.
//   await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
