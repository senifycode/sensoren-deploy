export interface Submodule {
	name: string;
	path: string;
	url: string;
	currentCommit: string;
	currentShortHash: string;
}

export interface Branch {
	name: string;
	displayName: string;
	isRemote: boolean;
}

export interface Commit {
	hash: string;
	shortHash: string;
	author: string;
	date: string;
	message: string;
}

export interface GitResult {
	success: boolean;
	output?: string;
	error?: string;
}
