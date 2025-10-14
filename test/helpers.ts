import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

export interface EnvFixture {
	dir: string;
	envPath: string;
	relativePath: string;
	write(content: string): void;
	cleanup(): void;
}

export const createEnvFixture = (content?: string): EnvFixture => {
	const dir = mkdtempSync(join(tmpdir(), 'env-loader-test-'));
	const envPath = join(dir, '.env');

	if (content !== undefined) {
		writeFileSync(envPath, content, 'utf8');
	}

	return {
		dir,
		envPath,
		relativePath: relative(process.cwd(), dir),
		write(newContent: string) {
			writeFileSync(envPath, newContent, 'utf8');
		},
		cleanup() {
			rmSync(dir, { recursive: true, force: true });
		},
	};
};
