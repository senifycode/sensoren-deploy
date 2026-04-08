import { intro, select, multiselect, isCancel, cancel, note, confirm, text } from '@clack/prompts';
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

	options.unshift({
		value: 'update-all',
		label: pc.green('🚀 Update multiple to latest'),
		hint: 'Quick update to HEAD of current branch'
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
	branchName: string,
	currentCommit?: string
): Promise<string | symbol> {
	const display = SUBMODULE_DISPLAY[submoduleName as keyof typeof SUBMODULE_DISPLAY] || {
		emoji: '📦',
		name: submoduleName
	};

	console.log();
	console.log(pc.cyan(`${display.emoji} ${display.name} → ${branchName}`));
	console.log();

	const options = [];

	if (commits.length > 0) {
		const isFirstCurrent = currentCommit && commits[0].hash.startsWith(currentCommit);

		options.push({
			value: commits[0].hash,
			label: isFirstCurrent
				? pc.magenta(`✨ ${commits[0].shortHash} - ${commits[0].message} (Latest, Current)`)
				: pc.green(`✨ ${commits[0].shortHash} - ${commits[0].message} (Latest)`),
			hint: `${commits[0].author}, ${commits[0].date}`
		});

		if (commits.length > 1) {
			options.push(...commits.slice(1).map((commit) => {
				const isCurrent = currentCommit && commit.hash.startsWith(currentCommit);
				return {
					value: commit.hash,
					label: isCurrent
						? pc.magenta(`${commit.shortHash} - ${commit.message} (Current)`)
						: `${commit.shortHash} - ${commit.message}`,
					hint: `${commit.author}, ${commit.date}`
				};
			}));
		}
	}

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

export async function showUpdateAllMenu(submodules: Submodule[]): Promise<string[] | symbol> {
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

	const selected = await multiselect({
		message: 'Select submodules to update to latest (space to select, enter to confirm):',
		options,
		required: false
	});

	if (isCancel(selected)) {
		cancel('Operation cancelled');
		process.exit(0);
	}

	return selected as string[];
}

export async function showCommitPrompt(): Promise<{ shouldCommit: boolean; message: string }> {
	const shouldCommit = await confirm({
		message: 'Commit and push changes to deploy repo?',
		initialValue: true
	});

	if (isCancel(shouldCommit) || !shouldCommit) {
		return { shouldCommit: false, message: '' };
	}

	const message = await text({
		message: 'Enter commit message:',
		placeholder: 'upd',
		defaultValue: 'upd',
		validate(value) {
			if (!value || value.trim().length === 0) {
				return 'Commit message cannot be empty';
			}
		}
	});

	if (isCancel(message)) {
		return { shouldCommit: false, message: '' };
	}

	return { shouldCommit: true, message: message as string };
}
