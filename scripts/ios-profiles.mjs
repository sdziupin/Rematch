// Fetches (or creates) the App Store provisioning profiles CI signs with, through the
// App Store Connect API, and installs them for Xcode. Each target's App ID is registered
// and given its capabilities if needed; a profile is regenerated when it's missing,
// expired, doesn't hold the distribution certificate or lacks an entitlement.
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (.p8), CERT_PEM (the distribution
// certificate in the keychain, PEM), and per target its profile name (APP_PROFILE,
// WIDGETS_PROFILE).
import { createPrivateKey, sign, X509Certificate } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const GROUP = 'group.com.sdziupin.rematch';
const TARGETS = [
  {
    identifier: 'com.sdziupin.rematch',
    name: 'REMATCH',
    profile: process.env.APP_PROFILE,
    capabilities: ['HEALTHKIT', 'APP_GROUPS', 'PUSH_NOTIFICATIONS'],
    entitlements: ['com.apple.developer.healthkit', 'aps-environment'],
  },
  {
    identifier: 'com.sdziupin.rematch.widgets',
    name: 'REMATCH Widgets',
    profile: process.env.WIDGETS_PROFILE,
    capabilities: ['APP_GROUPS'],
    entitlements: [],
  },
];
const PROFILE_DIRS = [
  join(homedir(), 'Library/MobileDevice/Provisioning Profiles'),
  join(homedir(), 'Library/Developer/Xcode/UserData/Provisioning Profiles'),
];

const key = createPrivateKey(readFileSync(process.env.ASC_KEY_PATH));

function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' })}.${b64({
    iss: process.env.ASC_ISSUER_ID,
    iat: now,
    exp: now + 15 * 60,
    aud: 'appstoreconnect-v1',
  })}`;
  const sig = sign('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' });
  return `${body}.${sig.toString('base64url')}`;
}

async function api(method, path, data) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: data ? JSON.stringify({ data }) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (json.errors ?? []).map((e) => e.detail ?? e.title).join('; ');
    const hint =
      res.status === 401 || res.status === 403
        ? ' The App Store Connect API key needs the Admin role to manage identifiers and profiles.'
        : '';
    throw new Error(`${method} ${path} → ${res.status}: ${detail}${hint}`);
  }
  return json;
}

// The plist inside a .mobileprovision is plain text within its CMS envelope.
function readProfile(base64) {
  const xml = Buffer.from(base64, 'base64').toString('latin1');
  const plist = xml.slice(xml.indexOf('<?xml'), xml.indexOf('</plist>') + 8);
  const ents = plist.slice(plist.indexOf('<key>Entitlements</key>'));
  const certs = plist.slice(plist.indexOf('<key>DeveloperCertificates</key>'), plist.indexOf('</array>', plist.indexOf('<key>DeveloperCertificates</key>')));
  return {
    uuid: /<key>UUID<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)[1],
    hasEntitlement: (k) => ents.includes(`<key>${k}</key>`),
    groups: [...(/<key>com\.apple\.security\.application-groups<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(ents)?.[1] ?? '').matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]),
    certs: [...certs.matchAll(/<data>([\s\S]*?)<\/data>/g)].map((m) => m[1].replace(/\s+/g, '')),
  };
}

function missing(target, profile, certDer) {
  const problems = [];
  if (!profile.certs.includes(certDer)) problems.push('distribution certificate');
  for (const e of target.entitlements) if (!profile.hasEntitlement(e)) problems.push(e);
  if (!profile.groups.includes(GROUP)) problems.push(`App Group ${GROUP}`);
  return problems;
}

// The distribution certificate on this machine, as App Store Connect knows it.
const pems = readFileSync(process.env.CERT_PEM, 'utf8').match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
const local = pems.map((p) => new X509Certificate(p));
const { data: certificates } = await api('GET', '/v1/certificates?limit=200');
let cert, certDer;
for (const c of certificates) {
  const match = local.find(
    (l) => l.raw.toString('base64') === c.attributes.certificateContent || l.serialNumber.toUpperCase() === c.attributes.serialNumber?.toUpperCase(),
  );
  if (match) [cert, certDer] = [c, match.raw.toString('base64')];
}
if (!cert) throw new Error(`None of the keychain's certificates (${local.map((l) => l.subject.split('\n').find((s) => s.startsWith('CN='))).join(', ')}) is registered in App Store Connect.`);
console.log(`Certificate: ${cert.attributes.name} (${cert.attributes.certificateType}), expires ${cert.attributes.expirationDate}`);

let failed = false;
for (const target of TARGETS) {
  const { data: found } = await api('GET', `/v1/bundleIds?filter[identifier]=${target.identifier}&filter[platform]=IOS&limit=200`);
  let bundle = found.find((b) => b.attributes.identifier === target.identifier);
  if (!bundle) {
    console.log(`${target.identifier}: registering App ID`);
    ({ data: bundle } = await api('POST', '/v1/bundleIds', {
      type: 'bundleIds',
      attributes: { identifier: target.identifier, name: target.name, platform: 'IOS' },
    }));
  }

  const { data: caps } = await api('GET', `/v1/bundleIds/${bundle.id}/bundleIdCapabilities?limit=200`);
  for (const type of target.capabilities) {
    if (caps.some((c) => c.attributes.capabilityType === type)) continue;
    console.log(`${target.identifier}: enabling ${type}`);
    await api('POST', '/v1/bundleIdCapabilities', {
      type: 'bundleIdCapabilities',
      attributes: { capabilityType: type },
      relationships: { bundleId: { data: { type: 'bundleIds', id: bundle.id } } },
    });
  }

  const { data: profiles } = await api('GET', `/v1/bundleIds/${bundle.id}/profiles?limit=200`);
  const usable = profiles
    .filter((p) => p.attributes.profileType === 'IOS_APP_STORE' && p.attributes.profileState === 'ACTIVE')
    .filter((p) => new Date(p.attributes.expirationDate) > new Date(Date.now() + 7 * 864e5));
  let chosen = usable.find((p) => p.attributes.name === target.profile && missing(target, readProfile(p.attributes.profileContent), certDer).length === 0);
  if (!chosen) {
    // Profile names are unique per team: replace the stale one of the same name.
    for (const p of profiles.filter((p) => p.attributes.name === target.profile)) {
      console.log(`${target.identifier}: deleting stale profile ${p.attributes.name} (${p.attributes.profileState})`);
      await api('DELETE', `/v1/profiles/${p.id}`);
    }
    console.log(`${target.identifier}: creating profile ${target.profile}`);
    ({ data: chosen } = await api('POST', '/v1/profiles', {
      type: 'profiles',
      attributes: { name: target.profile, profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bundle.id } },
        certificates: { data: [{ type: 'certificates', id: cert.id }] },
      },
    }));
  }

  const profile = readProfile(chosen.attributes.profileContent);
  const problems = missing(target, profile, certDer);
  if (problems.length) {
    failed = true;
    console.log(`::error::Profile ${target.profile} for ${target.identifier} lacks: ${problems.join(', ')}.` +
      (problems.some((p) => p.startsWith('App Group'))
        ? ` App Groups can't be assigned through the API: on developer.apple.com → Identifiers → ${target.identifier} → App Groups → Configure, tick ${GROUP} (create it under App Groups if it's not there), save, and re-run; CI regenerates the profile itself.`
        : ''));
    continue;
  }
  for (const dir of PROFILE_DIRS) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${profile.uuid}.mobileprovision`), Buffer.from(chosen.attributes.profileContent, 'base64'));
  }
  console.log(`${target.identifier}: ${target.profile} (${profile.uuid}), expires ${chosen.attributes.expirationDate}, groups ${profile.groups.join(', ')}`);
}
if (failed) process.exit(1);
