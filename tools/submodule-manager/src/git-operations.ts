import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, parse } from 'path';
import type { Submodule, Branch, Commit, GitResult } from './types.js';

export function findDeployRoot(startDir: string): string {
	let currentDir = startDir;
	const root = parse(currentDir).root;

	while (currentDir !== root) {
		const gitmodulesPath = join(currentDir, '.gitmodules');

		if (existsSync(gitmodulesPath)) {
			return currentDir;
		}

		const parentDir = dirname(currentDir);
		if (parentDir === currentDir) break;
		currentDir = parentDir;
	}

	throw new Error('Not in sensoren-deploy repository (no .gitmodules found)');
}

export async function executeGitCommand(
	command: string,
	args: string[],
	cwd: string
): Promise<GitResult> {
	return new Promise((resolve) => {
		const proc = spawn(command, args, {
			cwd,
			shell: true,
			windowsHide: true
		});

		let stdout = '';
		let stderr = '';

		proc.stdout?.on('data', (data) => {
			stdout += data.toString();
		});

		proc.stderr?.on('data', (data) => {
			stderr += data.toString();
		});

		proc.on('close', (code) => {
			if (code === 0) {
				resolve({ success: true, output: stdout.trim() });
			} else {
				resolve({ success: false, error: stderr.trim() || stdout.trim() });
			}
		});

		proc.on('error', (err) => {
			resolve({ success: false, error: err.message });
		});
	});
}

export async function parseGitmodules(deployRoot: string): Promise<Submodule[]> {
	const gitmodulesPath = join(deployRoot, '.gitmodules');

	if (!existsSync(gitmodulesPath)) {
		throw new Error('.gitmodules file not found');
	}

	const content = readFileSync(gitmodulesPath, 'utf-8');
	const submodules: Submodule[] = [];

	const sections = content.split('[submodule').filter((s) => s.trim());

	for (const section of sections) {
		const nameMatch = section.match(/"([^"]+)"/);
		const pathMatch = section.match(/path\s*=\s*(.+)/);
		const urlMatch = section.match(/url\s*=\s*(.+)/);

		if (nameMatch && pathMatch && urlMatch) {
			const name = nameMatch[1].trim();
			const path = pathMatch[1].trim();
			const url = urlMatch[1].trim();

			const statusResult = await executeGitCommand(
				'git',
				['submodule', 'status', path],
				deployRoot
			);

			let currentCommit = '';
			let currentShortHash = '';

			if (statusResult.success && statusResult.output) {
				const hashMatch = statusResult.output.match(/[\s+-]?([a-f0-9]{40})/);
				if (hashMatch) {
					currentCommit = hashMatch[1];
					currentShortHash = currentCommit.substring(0, 7);
				}
			}

			submodules.push({
				name,
				path,
				url,
				currentCommit,
				currentShortHash
			});
		}
	}

	return submodules;
}

export async function fetchSubmodule(submodulePath: string): Promise<GitResult> {
	return executeGitCommand('git', ['fetch', '--all'], submodulePath);
}

export async function getBranches(submodulePath: string): Promise<Branch[]> {
	const result = await executeGitCommand('git', ['branch', '-a'], submodulePath);

	if (!result.success || !result.output) {
		return [];
	}

	const branches: Branch[] = [];
	const lines = result.output.split('\n').filter((l) => l.trim());

	for (const line of lines) {
		const cleaned = line.replace(/^\*?\s+/, '');

		if (cleaned.includes('HEAD ->')) {
			continue;
		}

		const isRemote = cleaned.startsWith('remotes/');

		if (!isRemote) {
			continue;
		}

		const name = cleaned;
		const displayName = cleaned.replace('remotes/origin/', '') + ' (remote)';

		branches.push({
			name,
			displayName,
			isRemote
		});
	}

	branches.sort((a, b) => {
		if (a.isRemote && !b.isRemote) return -1;
		if (!a.isRemote && b.isRemote) return 1;
		return a.name.localeCompare(b.name);
	});

	return branches;
}

export async function getCommits(
	submodulePath: string,
	branch: string,
	limit: number = 50
): Promise<Commit[]> {
	const hashResult = await executeGitCommand(
		'git',
		['log', branch, '--oneline', `-n${limit}`],
		submodulePath
	);

	if (!hashResult.success || !hashResult.output) {
		return [];
	}

	const commits: Commit[] = [];
	const lines = hashResult.output.split('\n').filter((l) => l.trim());

	for (const line of lines) {
		const match = line.match(/^([a-f0-9]+)\s+(.+)$/);
		if (match) {
			const shortHash = match[1];
			let message = match[2];

			if (message.length > 60) {
				message = message.substring(0, 57) + '...';
			}

			const detailResult = await executeGitCommand(
				'git',
				['show', '-s', '--format=%H %an %ar', shortHash],
				submodulePath
			);

			let hash = shortHash;
			let author = 'Unknown';
			let date = '';

			if (detailResult.success && detailResult.output) {
				const parts = detailResult.output.trim().split(' ');
				if (parts.length >= 3) {
					hash = parts[0];
					author = parts.slice(1, -2).join(' ') || 'Unknown';
					date = parts.slice(-2).join(' ');
				}
			}

			commits.push({
				hash,
				shortHash,
				author,
				date,
				message
			});
		}
	}

	return commits;
}

export async function checkoutCommit(
	submodulePath: string,
	commitHash: string
): Promise<GitResult> {
	return executeGitCommand('git', ['checkout', commitHash], submodulePath);
}

export async function getCurrentBranch(submodulePath: string): Promise<string | null> {
	const result = await executeGitCommand(
		'git',
		['rev-parse', '--abbrev-ref', 'HEAD'],
		submodulePath
	);

	if (result.success && result.output && result.output !== 'HEAD') {
		return result.output.trim();
	}

	const symbolicResult = await executeGitCommand(
		'git',
		['symbolic-ref', '-q', 'HEAD'],
		submodulePath
	);

	if (symbolicResult.success && symbolicResult.output) {
		const match = symbolicResult.output.match(/refs\/heads\/(.+)/);
		if (match) {
			return match[1];
		}
	}

	const remoteResult = await executeGitCommand(
		'git',
		['branch', '-r', '--contains', 'HEAD'],
		submodulePath
	);

	if (remoteResult.success && remoteResult.output) {
		const lines = remoteResult.output.split('\n').filter((l) => l.trim());
		if (lines.length > 0) {
			const firstBranch = lines[0].replace(/^\s+/, '');
			return firstBranch;
		}
	}

	return 'remotes/origin/main';
}

export async function addAndCommit(
	deployRoot: string,
	submoduleNames: string[],
	message: string
): Promise<GitResult> {
	for (const name of submoduleNames) {
		const addResult = await executeGitCommand('git', ['add', name], deployRoot);
		if (!addResult.success) {
			return { success: false, error: `Failed to add ${name}: ${addResult.error}` };
		}
	}

	const commitResult = await executeGitCommand(
		'git',
		['commit', '-m', message],
		deployRoot
	);

	return commitResult;
}

export async function pushToRemote(deployRoot: string): Promise<GitResult> {
	return executeGitCommand('git', ['push'], deployRoot);
}
