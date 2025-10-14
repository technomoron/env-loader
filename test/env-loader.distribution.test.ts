import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createEnvFixture } from './helpers';

describe('EnvLoader distribution', () => {
	it('loads configuration when consumed as an ES module', async () => {
		const distUrl = new URL('../dist/esm/index.js', import.meta.url);
		const { EnvLoader, defineEnvOptions } = await import(distUrl.href);

		const fixture = createEnvFixture(
			['APP_PORT=8080', 'FEATURE_FLAGS=one,two,three', 'ADMIN_EMAIL=admin@example.com', 'ENABLE_CACHE=yes'].join(
				'\n'
			)
		);

		try {
			const envOptions = defineEnvOptions({
				APP_PORT: { description: 'port number', type: 'number', required: true },
				FEATURE_FLAGS: { description: 'flags list', type: 'strings', default: [] },
				ADMIN_EMAIL: { description: 'contact email', name: 'adminEmail', required: true },
				ENABLE_CACHE: { description: 'cache toggle', type: 'boolean', default: false },
			});

			const config = EnvLoader.createConfig(envOptions, {
				searchPaths: [fixture.relativePath],
				envFallback: false,
			});

			expect(config.APP_PORT).toBe(8080);
			expect(config.FEATURE_FLAGS).toEqual(['one', 'two', 'three']);
			expect(config.ADMIN_EMAIL).toBe('admin@example.com');
			expect(config.ENABLE_CACHE).toBe(true);
		} finally {
			fixture.cleanup();
		}
	});

	it('loads configuration when consumed as a CommonJS module', () => {
		const require = createRequire(import.meta.url);
		const distPath = fileURLToPath(new URL('../dist/cjs/index.js', import.meta.url));
		const { EnvLoader, defineEnvOptions } = require(distPath);

		const fixture = createEnvFixture(['PORT=3000', 'ENABLED=0', 'ALIASED=value'].join('\n'));

		try {
			const envOptions = defineEnvOptions({
				PORT: { description: 'port number', type: 'number', required: true },
				ENABLED: { description: 'boolean toggle', type: 'boolean', default: true },
				ALIASED: { description: 'alias mapping', name: 'aliasKey', required: true },
			});

			const configProxy = EnvLoader.createConfigProxy(envOptions, {
				searchPaths: [fixture.relativePath],
				envFallback: false,
			});

			expect(configProxy.PORT).toBe(3000);
			expect(configProxy.aliasKey).toBe('value');
			expect(configProxy.enabled).toBe(false);
			expect(() => (configProxy as Record<string, unknown>).missing).toThrowError(/Undefined environment key/);
		} finally {
			fixture.cleanup();
		}
	});
});
