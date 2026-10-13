const test = require('node:test');
const assert = require('node:assert/strict');
const {
    GITHUB_RELEASES_API,
    compareVersions,
    getLatestRelease,
    validateReleaseUrl
} = require('../github-updates');

test('compares release versions, including prereleases', () => {
    assert.equal(compareVersions('1.2.0', '1.1.9'), 1);
    assert.equal(compareVersions('v1.0.0', '1.0.0'), 0);
    assert.equal(compareVersions('1.0.0', '1.0.0-rc.1'), 1);
    assert.equal(compareVersions('1.0.0-beta.2', '1.0.0-beta.10'), -1);
});

test('validates links before they can be opened externally', () => {
    assert.equal(
        validateReleaseUrl('https://github.com/EfrainSN/QA-Suite-Xray/releases/tag/v1.1.0'),
        'https://github.com/EfrainSN/QA-Suite-Xray/releases/tag/v1.1.0'
    );
    assert.throws(() => validateReleaseUrl('https://example.com/releases/tag/v1.1.0'), /no pertenece/);
    assert.throws(() => validateReleaseUrl('https://github.com/EfrainSN/otro-repo/releases/tag/v1.1.0'), /no pertenece/);
});

test('returns a newer public release and its notes', async () => {
    let requestedUrl;
    const release = await getLatestRelease('1.0.0', async (url, options) => {
        requestedUrl = url;
        assert.equal(options.headers.Accept, 'application/vnd.github+json');
        return new Response(JSON.stringify({
            tag_name: 'v1.1.0',
            html_url: 'https://github.com/EfrainSN/QA-Suite-Xray/releases/tag/v1.1.0',
            body: 'CSV mejorado\nCorrecciones de errores'
        }), { status: 200 });
    });

    assert.equal(requestedUrl, GITHUB_RELEASES_API);
    assert.equal(release.latestVersion, '1.1.0');
    assert.equal(release.updateAvailable, true);
    assert.equal(release.releaseNotes, 'CSV mejorado\nCorrecciones de errores');
});

test('reports that the public repository has no published release yet', async () => {
    await assert.rejects(
        getLatestRelease('1.0.0', async () => new Response('', { status: 404 })),
        /Aún no hay un Release público/
    );
});
