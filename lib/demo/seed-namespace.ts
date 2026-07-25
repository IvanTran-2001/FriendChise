import crypto from "crypto";
import os from "os";
import { execSync } from "child_process";

let cachedSeedNamespace: string | null = null;

function normalizeNamespace(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function readGitUserName(): string | null {
	try {
		const value = execSync("git config --get user.name", {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		return value || null;
	} catch {
		return null;
	}
}

function readLocalUserName(): string | null {
	const envUser = process.env.USER ?? process.env.USERNAME;
	if (envUser) return envUser;

	try {
		return os.userInfo().username ?? null;
	} catch {
		return null;
	}
}

export function resolveSeedNamespace(): string {
	if (cachedSeedNamespace) return cachedSeedNamespace;

	const explicitNamespace = process.env.SEED_NAMESPACE?.trim();
	if (explicitNamespace) {
		if (explicitNamespace.toLowerCase() === "random") {
			cachedSeedNamespace = `run-${crypto.randomUUID().slice(0, 8)}`;
		} else {
			cachedSeedNamespace = normalizeNamespace(explicitNamespace);
		}
	} else {
		const fallback =
			readGitUserName() ??
			readLocalUserName() ??
			`run-${crypto.randomUUID().slice(0, 8)}`;
		cachedSeedNamespace = normalizeNamespace(fallback);
	}

	if (!cachedSeedNamespace) {
		cachedSeedNamespace = `run-${crypto.randomUUID().slice(0, 8)}`;
	}

	process.env.SEED_NAMESPACE = cachedSeedNamespace;
	return cachedSeedNamespace;
}

export function seedDisplayName(baseName: string): string {
	return `${baseName} [${resolveSeedNamespace()}]`;
}

export function seedEmail(localPart: string): string {
	const safeLocalPart = localPart
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ".")
		.replace(/^\.+|\.+$/g, "");

	return `${safeLocalPart}+${resolveSeedNamespace()}@example.test`;
}

export function resolveSeedEmail(
	envVarName: string,
	defaultLocalPart: string,
): string {
	const configured = process.env[envVarName]?.trim();
	return configured && configured.length > 0
		? configured
		: seedEmail(defaultLocalPart);
}
