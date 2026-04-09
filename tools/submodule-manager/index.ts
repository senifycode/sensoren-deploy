#!/usr/bin/env node

import { isCancel, cancel, spinner } from '@clack/prompts';
import pc from 'picocolors';
import { join } from 'path';
import {
	showIntro,
	showMainMenu,
	showBranchMenu,
	showCommitMenu,
	showSuccess,
	showError,
	showUpdateAllMenu,
	showCommitPrompt
} from './src/ui.js';
import {
	findDeployRoot,
	parseGitmodules,
	fetchSubmodule,
	getBranches,
	getCommits,
	checkoutCommit,
	getLatestRemoteCommit,
	addAndCommit,
	pushToRemote,
	getNonSubmoduleChanges,
	getChangedSubmodules
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

		if (selectedName === 'update-all') {
			const selectedSubmodules = await showUpdateAllMenu(submodules);

			if (isCancel(selectedSubmodules) || selectedSubmodules.length === 0) {
				continue;
			}

			let successCount = 0;
			let failCount = 0;

			for (const submoduleName of selectedSubmodules) {
				const submodule = submodules.find((s) => s.name === submoduleName);
				if (!submodule) continue;

				const submodulePath = join(deployRoot, submodule.path);
				const s = spinner();

				s.start(`${submodule.name}: Fetching latest...`);

				const fetchResult = await fetchSubmodule(submodulePath);
				if (!fetchResult.success) {
					s.stop(pc.red(`${submodule.name}: Failed to fetch`));
					failCount++;
					continue;
				}

				s.message(`${submodule.name}: Getting latest remote commit...`);

				const latestCommit = await getLatestRemoteCommit(submodulePath);
				if (!latestCommit) {
					s.stop(pc.red(`${submodule.name}: No commits found`));
					failCount++;
					continue;
				}
				s.message(`${submodule.name}: Checking out ${latestCommit.shortHash}...`);

				const checkoutResult = await checkoutCommit(submodulePath, latestCommit.hash);

				if (checkoutResult.success) {
					s.stop(pc.green(`✓ ${submodule.name}: ${latestCommit.shortHash} - ${latestCommit.message}`));
					successCount++;
				} else {
					s.stop(pc.red(`✗ ${submodule.name}: Checkout failed`));
					failCount++;
				}
			}

			console.log();
			if (failCount === 0) {
				showSuccess(
					`All ${successCount} submodule${successCount > 1 ? 's' : ''} updated successfully!`,
					'The parent deploy repo now has uncommitted changes.'
				);
			} else {
				showError(
					`Completed with ${successCount} success, ${failCount} failed`,
					'Check the errors above for details.'
				);
			}

			if (successCount > 0) {
				const commitPrompt = await showCommitPrompt();

				if (commitPrompt.shouldCommit) {
					const s = spinner();
					s.start('Committing changes...');

					const updatedSubmodules = selectedSubmodules.filter((name) =>
						submodules.some((sub) => sub.name === name)
					);

					const commitResult = await addAndCommit(
						deployRoot,
						updatedSubmodules,
						commitPrompt.message
					);

					if (commitResult.success) {
						s.stop(pc.green('✓ Changes committed'));

						const s2 = spinner();
						s2.start('Pushing to remote...');

						const pushResult = await pushToRemote(deployRoot);

						if (pushResult.success) {
							s2.stop(pc.green('✓ Pushed to remote'));
							showSuccess(
								'Deployment complete!',
								`Updated ${successCount} submodule${successCount > 1 ? 's' : ''}, committed and pushed.`
							);
						} else {
							s2.stop(pc.red('✗ Push failed'));
							showError('Failed to push to remote', pushResult.error);
						}
					} else {
						s.stop(pc.red('✗ Commit failed'));
						showError('Failed to commit changes', commitResult.error);
					}
				}
			}

			submodules = await parseGitmodules(deployRoot);
			continue;
		}

		if (selectedName === 'quick-commit') {
			const s = spinner();
			s.start('Checking working tree...');

			const nonSubmoduleChanges = await getNonSubmoduleChanges(deployRoot, submodules);

			if (nonSubmoduleChanges.length > 0) {
				s.stop(pc.red('Blocked: non-submodule changes detected'));
				showError(
					'Cannot commit — non-submodule changes present',
					nonSubmoduleChanges.map((f) => `  ${f}`).join('\n')
				);
				continue;
			}

			const changedSubmodules = await getChangedSubmodules(deployRoot, submodules);

			if (changedSubmodules.length === 0) {
				s.stop(pc.yellow('No submodule changes to commit'));
				continue;
			}

			s.stop(pc.green(`${changedSubmodules.length} submodule change(s) found`));

			const commitResult = await addAndCommit(deployRoot, changedSubmodules, 'upd');

			if (!commitResult.success) {
				showError('Commit failed', commitResult.error);
				continue;
			}

			const s2 = spinner();
			s2.start('Pushing to remote...');
			const pushResult = await pushToRemote(deployRoot);

			if (pushResult.success) {
				s2.stop(pc.green('✓ Pushed to remote'));
				showSuccess(
					'Done!',
					`Committed & pushed ${changedSubmodules.length} submodule change(s) with message "upd".`
				);
			} else {
				s2.stop(pc.red('✗ Push failed'));
				showError('Failed to push to remote', pushResult.error);
			}

			submodules = await parseGitmodules(deployRoot);
			continue;
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
					selectedBranch as string,
					submodule.currentCommit
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
