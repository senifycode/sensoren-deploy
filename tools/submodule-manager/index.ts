#!/usr/bin/env bun

import { isCancel, cancel, spinner } from '@clack/prompts';
import pc from 'picocolors';
import { join } from 'path';
import {
	showIntro,
	showMainMenu,
	showBranchMenu,
	showCommitMenu,
	showSuccess,
	showError
} from './src/ui.js';
import {
	findDeployRoot,
	parseGitmodules,
	fetchSubmodule,
	getBranches,
	getCommits,
	checkoutCommit
} from './src/git-operations.js';
import { DEFAULT_COMMIT_LIMIT } from './src/constants.js';

async function main() {
	console.clear();

	let deployRoot: string;
	try {
		deployRoot = findDeployRoot(process.cwd());
	} catch (error) {
		console.error(
			pc.red('Error:'),
			error instanceof Error ? error.message : 'Unknown error'
		);
		process.exit(1);
	}

	let submodules = await parseGitmodules(deployRoot);

	showIntro();
	console.log(pc.dim(`Repository: ${deployRoot}`));
	console.log(pc.dim(`Submodules: ${submodules.length} detected\n`));

	while (true) {
		const selectedName = await showMainMenu(submodules);

		if (isCancel(selectedName) || selectedName === 'exit') {
			cancel('Operation cancelled');
			process.exit(0);
		}

		const submodule = submodules.find((s) => s.name === selectedName);
		if (!submodule) continue;

		const submodulePath = join(deployRoot, submodule.path);

		while (true) {
			const s = spinner();
			s.start('Fetching branches from remote...');

			const fetchResult = await fetchSubmodule(submodulePath);
			if (!fetchResult.success) {
				s.stop(pc.red('Failed to fetch'));
				showError('Failed to fetch branches', fetchResult.error);
				break;
			}

			const branches = await getBranches(submodulePath);
			s.stop(pc.green('Branches loaded'));

			if (branches.length === 0) {
				showError('No branches found', 'The submodule may not be initialized');
				break;
			}

			const selectedBranch = await showBranchMenu(branches, submodule.name);

			if (isCancel(selectedBranch) || selectedBranch === 'back') {
				break;
			}

			while (true) {
				const s = spinner();
				s.start('Loading commits...');

				const commits = await getCommits(
					submodulePath,
					selectedBranch as string,
					DEFAULT_COMMIT_LIMIT
				);
				s.stop(pc.green(`${commits.length} commits loaded`));

				if (commits.length === 0) {
					showError('No commits found', 'The branch may be empty');
					break;
				}

				const selectedCommit = await showCommitMenu(
					commits,
					submodule.name,
					selectedBranch as string
				);

				if (isCancel(selectedCommit) || selectedCommit === 'back') {
					break;
				}

				const s2 = spinner();
				s2.start(`Checking out commit ${selectedCommit}...`);

				const checkoutResult = await checkoutCommit(
					submodulePath,
					selectedCommit as string
				);

				if (checkoutResult.success) {
					s2.stop(pc.green('✓ Checkout successful'));

					const commit = commits.find((c) => c.hash === selectedCommit);
					const details = commit
						? `Commit: ${commit.shortHash} - ${commit.message}\n\nThe parent deploy repo now has uncommitted changes.\nRun 'git status' in the deploy repo to see the change.`
						: 'The parent deploy repo now has uncommitted changes.';

					showSuccess(`Successfully checked out commit in ${submodule.name}`, details);

					submodules = await parseGitmodules(deployRoot);

					await new Promise((resolve) => setTimeout(resolve, 1000));
					break;
				} else {
					s2.stop(pc.red('✗ Checkout failed'));
					showError('Failed to checkout commit', checkoutResult.error);
				}
			}
		}
	}
}

main().catch((error) => {
	console.error(pc.red('Fatal error:'), error.message);
	process.exit(1);
});
