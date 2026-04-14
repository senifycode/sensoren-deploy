#!/usr/bin/env bun

import { intro, outro, select, multiselect, spinner, isCancel, cancel, note } from '@clack/prompts';
import { spawn } from 'child_process';
import pc from 'picocolors';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load configuration
interface ServiceConfig {
	name: string;
	path: string;
}

interface Config {
	services: Record<string, ServiceConfig>;
}

// Load config from the same directory as the executable
function loadConfig(): Config {
	const configPath = join(process.cwd(), 'config.json');

	if (!existsSync(configPath)) {
		console.error(pc.red(`Config file not found at: ${configPath}`));
		console.error(pc.yellow('Please ensure config.json is in the same directory as the executable'));
		process.exit(1);
	}

	try {
		const configData = readFileSync(configPath, 'utf-8');
		return JSON.parse(configData);
	} catch (error) {
		console.error(pc.red('Failed to load or parse config.json:'), error);
		process.exit(1);
	}
}

const config = loadConfig();
const SERVICES = config.services;
type ServiceKey = keyof typeof SERVICES;

async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, {
			cwd,
			shell: true,
			stdio: 'inherit'
		});

		proc.on('close', (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Command failed with exit code ${code}`));
			}
		});

		proc.on('error', (err) => {
			reject(err);
		});
	});
}

async function runCommandSilent(command: string, args: string[], cwd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, {
			cwd,
			shell: true,
			stdio: 'pipe'
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
				resolve(stdout);
			} else {
				reject(new Error(stderr || stdout || `Command failed with exit code ${code}`));
			}
		});

		proc.on('error', (err) => {
			reject(err);
		});
	});
}

async function checkRepoStatus(path: string): Promise<{ clean: boolean; message?: string }> {
	try {
		const output = await runCommandSilent('git', ['status', '--porcelain'], path);
		if (output.trim() === '') {
			return { clean: true };
		} else {
			return { clean: false, message: 'Repository has uncommitted changes' };
		}
	} catch (error) {
		return { clean: false, message: error instanceof Error ? error.message : 'Failed to check git status' };
	}
}

async function pullService(serviceKey: ServiceKey): Promise<{ success: boolean; skipped: boolean }> {
	const service = SERVICES[serviceKey];
	const s = spinner();

	try {
		console.log();
		note(pc.cyan(`Pulling ${service.name}...`), pc.bold(serviceKey));

		// Check repo status
		s.start('Checking repository status...');
		const status = await checkRepoStatus(service.path);

		if (!status.clean) {
			s.stop(pc.yellow('⚠ Skipped'));
			console.log(pc.yellow(`⚠ ${service.name} has uncommitted changes - skipping pull`));
			if (status.message) {
				console.log(pc.dim(`  ${status.message}`));
			}
			return { success: true, skipped: true };
		}
		s.stop(pc.green('✓ Repository is clean'));

		// Pull repository and update submodules
		s.start('Pulling from remote...');
		await runCommand('git', ['pull', '--recurse-submodules'], service.path);
		s.stop(pc.green('✓ Repository updated successfully'));

		// Ensure submodules are on correct commit (in case --recurse-submodules didn't work)
		s.start('Updating submodules...');
		await runCommand('git', ['submodule', 'update', '--init', '--recursive'], service.path);
		s.stop(pc.green('✓ Submodules updated successfully'));

		console.log(pc.green(`✓ ${service.name} completed!`));
		return { success: true, skipped: false };
	} catch (error) {
		s.stop(pc.red('✗ Failed'));
		console.error(pc.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
		console.log(pc.red(`✗ ${service.name} failed!`));
		return { success: false, skipped: false };
	}
}

async function updateSharedUtils(serviceKey: ServiceKey): Promise<boolean> {
	const service = SERVICES[serviceKey];
	const s = spinner();

	try {
		console.log();
		note(pc.cyan(`Updating ${service.name}...`), pc.bold(serviceKey));

		// Update shared-utils submodule
		s.start('Updating shared-utils submodule...');
		await runCommand('git', ['submodule', 'update', '--remote', 'shared-utils'], service.path);
		s.stop(pc.green('✓ Submodule updated successfully'));

		// Run bun install
		s.start('Installing dependencies with bun...');
		await runCommand('bun', ['install'], service.path);
		s.stop(pc.green('✓ Dependencies installed successfully'));

		console.log(pc.green(`✓ ${service.name} completed!`));
		return true;
	} catch (error) {
		s.stop(pc.red('✗ Failed'));
		console.error(pc.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
		console.log(pc.red(`✗ ${service.name} failed!`));
		return false;
	}
}

async function main() {
	console.clear();

	intro(pc.bgCyan(pc.black(' Service Manager ')));

	const action = await select({
		message: 'What would you like to do?',
		options: [
			{
				value: 'pull',
				label: '🔄 Pull all repos',
				hint: 'Pull latest changes from git (laptop ↔ PC sync)'
			},
			{
				value: 'update-shared',
				label: '🔧 Update shared-utils',
				hint: 'Update shared-utils submodule and run bun install'
			}
		]
	});

	if (isCancel(action)) {
		cancel('Operation cancelled');
		process.exit(0);
	}

	const selectedServices = await multiselect({
		message: 'Pick services (use space to select, enter to confirm)',
		options: Object.keys(SERVICES).map((key) => ({
			value: key,
			label: `${getServiceEmoji(key)} ${SERVICES[key].name}`,
			hint: getServiceHint(key)
		})),
		required: true
	});

	if (isCancel(selectedServices)) {
		cancel('Operation cancelled');
		process.exit(0);
	}

	const services = selectedServices as ServiceKey[];

	if (services.length === 0) {
		cancel('No services selected');
		process.exit(0);
	}

	if (action === 'pull') {
		console.log(pc.dim(`\nPulling ${services.length} repositor${services.length > 1 ? 'ies' : 'y'}...\n`));

		let successCount = 0;
		let failCount = 0;
		let skippedCount = 0;

		for (const serviceKey of services) {
			const result = await pullService(serviceKey);
			if (result.skipped) {
				skippedCount++;
			} else if (result.success) {
				successCount++;
			} else {
				failCount++;
			}
		}

		console.log();
		if (failCount === 0 && skippedCount === 0) {
			outro(pc.green(`✓ All ${successCount} repositor${successCount > 1 ? 'ies' : 'y'} pulled successfully! 🎉`));
		} else if (failCount === 0) {
			outro(pc.yellow(`✓ ${successCount} pulled, ${skippedCount} skipped (uncommitted changes)`));
		} else {
			outro(pc.yellow(`⚠ Completed with ${successCount} success, ${failCount} failed, ${skippedCount} skipped`));
		}
	} else if (action === 'update-shared') {
		console.log(pc.dim(`\nUpdating shared-utils in ${services.length} service${services.length > 1 ? 's' : ''}...\n`));

		let successCount = 0;
		let failCount = 0;

		for (const serviceKey of services) {
			const success = await updateSharedUtils(serviceKey);
			if (success) {
				successCount++;
			} else {
				failCount++;
			}
		}

		console.log();
		if (failCount === 0) {
			outro(pc.green(`✓ All ${successCount} service${successCount > 1 ? 's' : ''} updated successfully! 🎉`));
		} else {
			outro(pc.yellow(`⚠ Completed with ${successCount} success, ${failCount} failed`));
		}
	}
}

function getServiceEmoji(key: string): string {
	const emojis: Record<string, string> = {
		main: '📱',
		broker: '🔌',
		backup: '💾',
		websocket: '🔗',
		shared: '🔧'
	};
	return emojis[key] || '📦';
}

function getServiceHint(key: string): string {
	const hints: Record<string, string> = {
		main: 'Sensoren-Server',
		broker: 'MQTT Broker',
		backup: 'Backup Manager',
		websocket: 'WebSocket Server',
		shared: 'Shared Utilities'
	};
	return hints[key] || '';
}

main().catch((error) => {
	console.error(pc.red('Fatal error:'), error);
	process.exit(1);
});
