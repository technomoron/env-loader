import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import EnvLoader, { defineEnvOptions } from '../src/env-loader.js';

import { createEnvFixture } from './helpers';

describe('EnvLoader core behavior', () => {
	it('parses built-in types, defaults, and option lists', () => {
		const fixture = createEnvFixture(
			['PORT=5000', 'FEATURES=alpha,beta', 'DEBUG=1', 'ENVIRONMENT=production'].join('\n')
		);

		try {
			const envOptions = defineEnvOptions({
				PORT: { type: 'number', required: true },
				FEATURES: { type: 'strings', default: [] },
				DEBUG: { type: 'boolean', default: false },
				ENVIRONMENT: { options: ['production', 'staging'], default: 'staging' },
				OPTIONAL: { default: 'fallback' },
			});

			const config = EnvLoader.createConfig(envOptions, {
				searchPaths: [fixture.relativePath],
				envFallback: false,
			});

			expect(config.PORT).toBe(5000);
			expect(config.FEATURES).toEqual(['alpha', 'beta']);
			expect(config.DEBUG).toBe(true);
			expect(config.ENVIRONMENT).toBe('production');
			expect(config.OPTIONAL).toBe('fallback');
		} finally {
			fixture.cleanup();
		}
	});

	it('raises helpful errors for missing required values', () => {
		const fixture = createEnvFixture('OPTIONAL=value');

		try {
			const envOptions = defineEnvOptions({
				REQUIRED: { required: true },
				OPTIONAL: { default: 'fallback' },
			});

			expect(() =>
				EnvLoader.createConfig(envOptions, {
					searchPaths: [fixture.relativePath],
					envFallback: false,
				})
			).toThrowError(/Missing required: REQUIRED/);
		} finally {
			fixture.cleanup();
		}
	});

	it('enforces allowed values when options list provided', () => {
		const fixture = createEnvFixture('MODE=invalid');

		try {
			const envOptions = defineEnvOptions({
				MODE: { options: ['production', 'development'], required: true },
			});

			expect(() =>
				EnvLoader.createConfig(envOptions, {
					searchPaths: [fixture.relativePath],
					envFallback: false,
				})
			).toThrowError(/Invalid 'MODE': invalid/);
		} finally {
			fixture.cleanup();
		}
	});

	it('applies custom transforms and zod schemas', () => {
		const fixture = createEnvFixture(['CUSTOM={"value":42}', 'STRICT=10'].join('\n'));

		try {
			const envOptions = defineEnvOptions({
				CUSTOM: { transform: (raw) => JSON.parse(raw).value },
				STRICT: { zodSchema: z.coerce.number().min(10) },
			});

			const config = EnvLoader.createConfig(envOptions, {
				searchPaths: [fixture.relativePath],
				envFallback: false,
			});

			expect(config.CUSTOM).toBe(42);
			expect(config.STRICT).toBe(10);
		} finally {
			fixture.cleanup();
		}
	});

	it('surfaces zod validation errors verbosely', () => {
		const fixture = createEnvFixture('STRICT=4');

		try {
			const envOptions = defineEnvOptions({
				STRICT: { zodSchema: z.coerce.number().min(10) },
			});

			expect(() =>
				EnvLoader.createConfig(envOptions, {
					searchPaths: [fixture.relativePath],
					envFallback: false,
				})
			).toThrowError(/Number must be greater than or equal to 10/);
		} finally {
			fixture.cleanup();
		}
	});

	it('falls back to process.env when enabled', () => {
		const fixture = createEnvFixture();

		const original = process.env.RUNTIME_ONLY;
		process.env.RUNTIME_ONLY = 'from-process-env';

		try {
			const envOptions = defineEnvOptions({
				RUNTIME_ONLY: { required: true },
			});

			const config = EnvLoader.createConfig(envOptions, {
				searchPaths: [fixture.relativePath],
				envFallback: true,
			});

			expect(config.RUNTIME_ONLY).toBe('from-process-env');
		} finally {
			process.env.RUNTIME_ONLY = original;
			fixture.cleanup();
		}
	});

	it('createConfigProxy adds aliases, case-insensitive lookups, and throws on missing keys', () => {
		const fixture = createEnvFixture(['PORT=1234', 'ALIASED=value'].join('\n'));

		try {
			const envOptions = defineEnvOptions({
				PORT: { type: 'number', required: true },
				ALIASED: { name: 'aliasKey', required: true },
			});

			const configProxy = EnvLoader.createConfigProxy(envOptions, {
				searchPaths: [fixture.relativePath],
				envFallback: false,
			});

			expect(configProxy.PORT).toBe(1234);
			expect(configProxy.port).toBe(1234);
			expect(configProxy.aliasKey).toBe('value');
			expect(() => (configProxy as Record<string, unknown>).missing).toThrowError(/Undefined environment key/);
		} finally {
			fixture.cleanup();
		}
	});

	it('generates annotated templates with genTemplate', () => {
		const fixture = createEnvFixture();
		const templatePath = join(fixture.dir, 'template.env');

		try {
			const templateOptions = defineEnvOptions({
				API_KEY: { description: 'External API key', required: true },
				LOG_LEVEL: { description: 'Log verbosity', options: ['info', 'debug'], default: 'info' },
				PORT: { description: 'Port number', type: 'number', default: 3000 },
			});

			EnvLoader.genTemplate(templateOptions, templatePath);

			const contents = readFileSync(templatePath, 'utf8');
			expect(contents).toBe(
				[
					'# External API key (required)',
					'API_KEY=',
					'',
					'# Log verbosity Possible values: info, debug',
					'LOG_LEVEL=info',
					'',
					'# Port number [number]',
					'PORT=3000',
					'',
				].join('\n')
			);
		} finally {
			fixture.cleanup();
		}
	});
});
