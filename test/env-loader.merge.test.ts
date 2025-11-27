import { writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import EnvLoader, { defineEnvOptions } from '../src/env-loader.js';

import { createEnvFixture } from './helpers';

describe('EnvLoader merging .env files', () => {
	it('merges multiple files in order when merge is true', () => {
		const fixture = createEnvFixture();
		try {
			fixture.write('SHARED=base\nOVERRIDE=base');
			// add overrides
			const overridePath = fixture.envPath.replace('.env', '.env.override');
			fixture.write(['SHARED=base', 'OVERRIDE=base'].join('\n'));
			writeFileSync(overridePath, ['OVERRIDE=override', 'EXTRA=added'].join('\n'), 'utf8');

			const envOptions = defineEnvOptions({
				SHARED: { required: true },
				OVERRIDE: { required: true },
				EXTRA: { required: true },
			});

			const config = EnvLoader.createConfig(envOptions, {
				searchPaths: [fixture.relativePath],
				fileNames: ['.env', '.env.override'],
				merge: true,
				envFallback: false,
			});

			expect(config.SHARED).toBe('base');
			expect(config.OVERRIDE).toBe('override'); // from override file
			expect(config.EXTRA).toBe('added');
		} finally {
			fixture.cleanup();
		}
	});

	it('stops at first found file when merge is false', () => {
		const fixture = createEnvFixture('ONLY=first');
		try {
			const extraPath = fixture.envPath.replace('.env', '.env.extra');
			writeFileSync(extraPath, 'ONLY=second', 'utf8');

			const envOptions = defineEnvOptions({
				ONLY: { required: true },
			});

			const config = EnvLoader.createConfig(envOptions, {
				searchPaths: [fixture.relativePath],
				fileNames: ['.env', '.env.extra'],
				merge: false,
				envFallback: false,
			});

			expect(config.ONLY).toBe('first');
		} finally {
			fixture.cleanup();
		}
	});
});
