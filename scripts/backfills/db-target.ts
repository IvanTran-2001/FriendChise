type DatabaseTarget = {
	hostname: string;
	username: string;
	isLocalDev: boolean;
	isProductionTarget: boolean;
};

export function resolveDatabaseTarget(dbUrl: string): DatabaseTarget {
	const parsedUrl = new URL(dbUrl);
	const devIdentifiers = (process.env.SEED_DEV_IDENTIFIERS ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	const isLocalDev =
		parsedUrl.hostname === "localhost" ||
		parsedUrl.hostname === "127.0.0.1" ||
		parsedUrl.hostname === "::1" ||
		/(?:^|\.)dev(?:\.|$)/i.test(parsedUrl.hostname) ||
		/(?:^|[._-])dev(?:[._-]|$)/i.test(parsedUrl.username) ||
		devIdentifiers.some((id) => parsedUrl.username === id || parsedUrl.hostname === id);

	return {
		hostname: parsedUrl.hostname,
		username: parsedUrl.username,
		isLocalDev,
		isProductionTarget: !isLocalDev,
	};
}
