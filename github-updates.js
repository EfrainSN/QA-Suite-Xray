const GITHUB_OWNER = 'EfrainSN';
const GITHUB_REPOSITORY = 'QA-Suite-Xray';
const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/releases/latest`;
const GITHUB_RELEASE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/releases`;

function parseVersion(value) {
    const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
    if (!match) throw new Error(`La versión "${value}" no cumple el formato semver X.Y.Z.`);
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: match[4] || ''
    };
}

function compareVersions(left, right) {
    const a = parseVersion(left);
    const b = parseVersion(right);
    for (const part of ['major', 'minor', 'patch']) {
        if (a[part] !== b[part]) return a[part] > b[part] ? 1 : -1;
    }
    if (a.prerelease === b.prerelease) return 0;
    if (!a.prerelease) return 1;
    if (!b.prerelease) return -1;

    const aParts = a.prerelease.split('.');
    const bParts = b.prerelease.split('.');
    for (let index = 0; index < Math.max(aParts.length, bParts.length); index++) {
        if (aParts[index] === undefined) return -1;
        if (bParts[index] === undefined) return 1;
        if (aParts[index] === bParts[index]) continue;
        const aNumeric = /^\d+$/.test(aParts[index]);
        const bNumeric = /^\d+$/.test(bParts[index]);
        if (aNumeric && bNumeric) return Number(aParts[index]) > Number(bParts[index]) ? 1 : -1;
        if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
        return aParts[index] > bParts[index] ? 1 : -1;
    }
    return 0;
}

function validateReleaseUrl(value) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error('GitHub devolvió una URL de Release no válida.');
    }
    if (
        url.protocol !== 'https:' ||
        url.hostname !== 'github.com' ||
        !url.pathname.startsWith(`/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/releases/`)
    ) {
        throw new Error('La URL del Release no pertenece al repositorio configurado.');
    }
    return url.toString();
}

async function getLatestRelease(currentVersion, fetchImpl = fetch) {
    parseVersion(currentVersion);
    const response = await fetchImpl(GITHUB_RELEASES_API, {
        headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'QA-Suite-Xray-Updater'
        },
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Aún no hay un Release público en EfrainSN/QA-Suite-Xray.');
        }
        if (response.status === 403 || response.status === 429) {
            throw new Error('GitHub limitó temporalmente las consultas. Inténtalo más tarde.');
        }
        throw new Error(`GitHub respondió con el estado ${response.status}.`);
    }

    let release;
    try {
        release = await response.json();
    } catch {
        throw new Error('GitHub devolvió una respuesta que no se pudo interpretar.');
    }

    const latestVersion = typeof release?.tag_name === 'string'
        ? release.tag_name.replace(/^v/, '')
        : '';
    parseVersion(latestVersion);
    const releaseUrl = validateReleaseUrl(release.html_url);
    return {
        currentVersion,
        latestVersion,
        releaseUrl,
        releaseNotes: typeof release.body === 'string' && release.body.trim()
            ? release.body.trim().slice(0, 12000)
            : 'Este Release no incluye notas de cambios.',
        updateAvailable: compareVersions(latestVersion, currentVersion) > 0
    };
}

module.exports = {
    GITHUB_RELEASES_API,
    GITHUB_RELEASE_URL,
    compareVersions,
    getLatestRelease,
    validateReleaseUrl
};
