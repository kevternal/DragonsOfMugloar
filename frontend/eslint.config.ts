import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
    {
        name: 'app/files-to-lint',
        files: ['**/*.{vue,ts,mts,tsx}'],
    },

    globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

    ...pluginVue.configs['flat/essential'],
    vueTsConfigs.recommended,

    {
        ...pluginVitest.configs.recommended,
        files: ['src/**/__tests__/*'],
    },

    {
        name: 'app/no-v-html',
        files: ['**/*.vue'],
        rules: { 'vue/no-v-html': 'error' },
    },

    // AD-1: dependency direction, enforced per folder.
    {
        name: 'app/boundaries-components',
        files: ['src/components/**/*.{vue,ts}'],
        ignores: ['**/__tests__/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@/stores/*', '**/stores/*'],
                            message: 'components/ never imports stores/ (AD-1).',
                        },
                        {
                            group: ['@/api/*', '**/api/*'],
                            message: 'components/ never imports api/ (AD-1).',
                        },
                        {
                            group: ['@/views/*', '**/views/*'],
                            message: 'components/ never imports views/ (AD-1).',
                        },
                        {
                            group: ['@/router/*', '**/router/*'],
                            message: 'components/ never imports router/ (AD-1).',
                        },
                    ],
                },
            ],
        },
    },
    {
        name: 'app/boundaries-game',
        files: ['src/game/**/*.ts'],
        ignores: ['**/__tests__/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    paths: [
                        { name: 'vue', message: 'game/ imports no Vue (AD-1).' },
                        { name: 'pinia', message: 'game/ imports no Pinia (AD-1).' },
                    ],
                    patterns: [
                        {
                            group: ['@/api/*', '**/api/*'],
                            allowTypeImports: true,
                            message: 'game/ may only `import type` from api/ (AD-1).',
                        },
                        {
                            group: [
                                '@/stores/*',
                                '@/views/*',
                                '@/components/*',
                                '@/router/*',
                                '**/stores/*',
                                '**/views/*',
                                '**/components/*',
                                '**/router/*',
                            ],
                            message: 'game/ is a leaf layer (AD-1).',
                        },
                    ],
                },
            ],
        },
    },
    {
        name: 'app/boundaries-views',
        files: ['src/views/**/*.{vue,ts}'],
        ignores: ['**/__tests__/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@/api/*', '**/api/*'],
                            message: 'views/ never import api/ (AD-1).',
                        },
                    ],
                },
            ],
        },
    },
    {
        name: 'app/boundaries-router',
        files: ['src/router/**/*.ts'],
        ignores: ['**/__tests__/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '@/api/*',
                                '@/stores/*',
                                '@/game/*',
                                '@/components/*',
                                '**/api/*',
                                '**/stores/*',
                                '**/game/*',
                                '**/components/*',
                            ],
                            message: 'router/ imports only views (AD-1).',
                        },
                    ],
                },
            ],
        },
    },

    ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

    skipFormatting,
)
