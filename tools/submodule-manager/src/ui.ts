import { intro, select, isCancel, cancel, note } from '@clack/prompts';
import pc from 'picocolors';
import type { Submodule, Branch, Commit } from './types.js';
import { SUBMODULE_DISPLAY } from './constants.js';

export function showIntro(): void {
	intro(pc.bgCyan(pc.black(' Git Submodule Commit Manager ')));
}

export async function showMainMenu(submodules: Submodule[]): Promise<string | symbol> {
	const options = submodules.map((sub) => {
		const display = SUBMODULE_DISPLAY[sub.name as keyof typeof SUBMODULE_DISPLAY] || {
			emoji: '📦',
			name: sub.name
		};

		return {
			value: sub.name,
			label: `${display.emoji} ${display.name}`,
			hint: sub.currentShortHash ? `Current: ${sub.currentShortHash}` : ''
		};
	});

	options.push({
		value: 'exit',
		label: pc.dim('Exit'),
		hint: ''
	});

	const selected = await select({
		message: 'Select a submodule to update or exit:',
		options
	});

	if (isCancel(selected)) {
		cancel('Operation cancelled');
		process.exit(0);
	}

	return selected;
}

export async function showBranchMenu(
	branches: Branch[],
	submoduleName: string
): Promise<string | symbol> {
	const display = SUBMODULE_DISPLAY[submoduleName as keyof typeof SUBMODULE_DISPLAY] || {
		emoji: '📦',
		name: submoduleName
	};

	console.log();
	console.log(pc.cyan(`${display.emoji} ${display.name}`));
	console.log();

	const options = branches.map((branch) => ({
		value: branch.name,
		label: `🌿 ${branch.displayName}`
	}));

	options.push({
		value: 'back',
		label: pc.dim('⬅️  Back to main menu')
	});

	const selected = await select({
		message: 'Select a branch:',
		options
	});

	if (isCancel(selected)) {
		cancel('Operation cancelled');
		process.exit(0);
	}

	return selected;
}

export async function showCommitMenu(
	commits: Commit[],
	submoduleName: string,
	branchName: string
): Promise<string | symbol> {
	const display = SUBMODULE_DISPLAY[submoduleName as keyof typeof SUBMODULE_DISPLAY] || {
		emoji: '📦',
		name: submoduleName
	};

	console.log();
	console.log(pc.cyan(`${display.emoji} ${display.name} → ${branchName}`));
	console.log();

	const options = commits.map((commit) => ({
		value: commit.hash,
		label: `${commit.shortHash} - ${commit.message}`,
		hint: `${commit.author}, ${commit.date}`
	}));

	options.push({
		value: 'back',
		label: pc.dim('⬅️  Back to branch selection'),
		hint: ''
	});

	const selected = await select({
		message: 'Select a commit to checkout:',
		options
	});

	if (isCancel(selected)) {
		cancel('Operation cancelled');
		process.exit(0);
	}

	return selected;
}

export function showSuccess(message: string, details?: string): void {
	console.log();
	note(pc.green(details || ''), pc.green(message));
	console.log();
}

export function showError(message: string, details?: string): void {
	console.log();
	note(pc.red(details || 'An error occurred'), pc.red(message));
	console.log();
}
