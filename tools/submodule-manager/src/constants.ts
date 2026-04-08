export const SUBMODULE_DISPLAY = {
	'sensoren-server': { emoji: '📱', name: 'Sensoren-Server (Frontend)' },
	'broker-service': { emoji: '🔌', name: 'MQTT Broker Service' },
	'websocket-service': { emoji: '🔗', name: 'WebSocket Service' },
	'backup-service': { emoji: '💾', name: 'Backup Service' },
	'shared-utils': { emoji: '🛠️', name: 'Shared Utils' }
} as const;

export const DEFAULT_COMMIT_LIMIT = 50;
export const GIT_COMMAND_TIMEOUT = 30000;
