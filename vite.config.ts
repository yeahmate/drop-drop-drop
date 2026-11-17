import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [
		svelte(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg'],
			manifest: {
				name: 'Drop Drop Drop',
				short_name: 'Drop3',
				description: 'Course planning and mark laying tools for sailing race teams.',
				theme_color: '#0B1F33',
				background_color: '#FFFFFF',
				display: 'standalone',
				icons: [
					{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
				],
			},
		}),
	],
	// Svelte needs its browser build when components run under Vitest. Leave
	// the default conditions alone for the real build.
	resolve: process.env.VITEST ? { conditions: ['browser'] } : {},
	test: {
		include: ['src/**/*.test.ts', 'deploy/**/*.test.ts'],
		environment: 'jsdom',
	},
})
