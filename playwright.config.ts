import { defineConfig, devices } from '@playwright/test'

/**
 * e2e — только то, что jsdom не умеет по устройству: раскладка и перетаскивание,
 * настоящая клавиатура, буфер обмена, выбор файла, медиазапросы темы.
 * Логика (причины, Pinia, бюджеты, отчёты) проверяется юнит-тестами в test/.
 */
export default defineConfig({
    testDir: 'e2e',
    testMatch: '**/*.e2e.ts',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: 'http://localhost:5299',
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npx vite --config e2e/fixture/vite.config.ts',
        url: 'http://localhost:5299',
        reuseExistingServer: !process.env.CI,
    },
})
