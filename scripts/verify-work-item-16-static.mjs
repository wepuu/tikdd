import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), "utf8");

function serviceBlock(compose, name) {
  const pattern = new RegExp(`^  ${name.replaceAll("-", "\\-")}:\\r?\\n([\\s\\S]*?)(?=^  [a-z0-9][a-z0-9-]*:\\r?$|^networks:\\r?$)`, "m");
  const match = compose.match(pattern);
  if (!match) throw new Error(`Production Compose service is missing: ${name}`);
  return match[1];
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

function declaredNetworks(block) {
  const match = block.match(/^    networks:\r?\n((?:      - [a-z0-9-]+\r?\n)+)/m);
  return match ? [...match[1].matchAll(/- ([a-z0-9-]+)/g)].map((item) => item[1]) : [];
}

export function verifyWorkItem16Static() {
  const compose = read("compose.production.yml");
  const dockerfile = read("Dockerfile.production");
  const productionEnvironment = read("deploy/production.env.example");
  const nginxTemplate = read("deploy/nginx/tikdd.conf.template");
  const secretEntrypoint = read("docker/secret-entrypoint.sh");
  const releaseScript = read("scripts/production-release.sh");

  const allServices = [
    "postgres", "redis", "web", "api", "worker", "delivery", "admin-api", "admin",
    "migration", "preflight", "canary", "evidence", "cleanup", "cleanup-dry-run", "admin-account"
  ];
  const blocks = Object.fromEntries(allServices.map((name) => [name, serviceBlock(compose, name)]));

  assert(!/^  (?:nginx|cloudflared|scheduler|cron):/m.test(compose), "Host ingress or a scheduler leaked into TikDD Compose.");
  assert(/^networks:\r?\n  data:\r?\n    internal: true\r?\n    ipam:/m.test(compose), "The internal data network must declare stable IPAM.");
  assert(/^  host-ingress:\r?\n    driver: bridge\r?\n    driver_opts:/m.test(compose), "The host-ingress network must be an explicit bridge.");
  assert(/com\.docker\.network\.bridge\.host_binding_ipv4: "127\.0\.0\.1"/.test(compose), "Host ingress must default published ports to loopback.");
  assert(/com\.docker\.network\.bridge\.enable_ip_masquerade: "false"/.test(compose), "Host ingress must not grant general outbound masquerading.");
  assert(/^  provider-egress:\r?\n    ipam:/m.test(compose), "The provider-egress network must declare stable IPAM.");
  for (const binding of ["TIKDD_DATA_SUBNET", "TIKDD_DATA_GATEWAY", "TIKDD_HOST_INGRESS_SUBNET", "TIKDD_HOST_INGRESS_GATEWAY", "TIKDD_PROVIDER_EGRESS_SUBNET", "TIKDD_PROVIDER_EGRESS_GATEWAY"]) {
    assert(new RegExp(`^${binding}=`, "m").test(productionEnvironment), `${binding} is missing from production configuration.`);
  }
  assert(/^TIKDD_DATA_SUBNET=172\.30\.40\.0\/24$/m.test(productionEnvironment), "The reviewed NL data subnet changed unexpectedly.");
  assert(/^TIKDD_HOST_INGRESS_SUBNET=172\.30\.42\.0\/24$/m.test(productionEnvironment), "The reviewed NL host-ingress subnet changed unexpectedly.");
  assert(/^TIKDD_PROVIDER_EGRESS_SUBNET=172\.30\.41\.0\/24$/m.test(productionEnvironment), "The reviewed NL egress subnet changed unexpectedly.");
  assert(/^TRUSTED_PROXY_CIDRS=172\.30\.42\.1\/32$/m.test(productionEnvironment), "The candidate trusted proxy must be the exact reviewed host-ingress gateway.");

  assert(/listen 127\.0\.0\.1:__TIKDD_NGINX_ORIGIN_PORT__/g.test(nginxTemplate), "The Tunnel origin must bind to loopback.");
  assert(!/listen (?:0\.0\.0\.0|\[::\]|80|443)/.test(nginxTemplate), "The TikDD Tunnel origin must not create a public listener.");
  assert(/server_name __TIKDD_WEB_HOST__;/.test(nginxTemplate), "The canonical Web host is missing from the Tunnel origin.");
  assert((nginxTemplate.match(/^\s+~\^\/[a-z0-9-]+\/\?\$ 1;$/gm) ?? []).length === 108, "The evidence-derived legacy slug allowlist must remain exact and complete.");
  assert(!/map_hash_bucket_size/.test(nginxTemplate), "The TikDD include must not override shared Nginx hash settings.");
  assert(/map \$uri \$tikdd_legacy_home_redirect \{[\s\S]*~\^\/i\(\?:\/\[\^\/\]\+\)\?\/\?\$ 1;/.test(nginxTemplate), "The bounded legacy result redirect is missing.");
  assert((nginxTemplate.match(/if \(\$tikdd_legacy_home_redirect\) \{ return 301 https:\/\/__TIKDD_WEB_HOST__\/; \}/g) ?? []).length === 2, "Legacy redirects must be one-hop and limited to canonical Web plus apex.");
  assert(!/if \(\$tikdd_legacy_home_redirect\)[^\n]*\$request_uri/.test(nginxTemplate), "Legacy redirects must drop obsolete query data.");
  assert(/server_name __TIKDD_WEB_APEX_HOST__;[\s\S]*return 301 https:\/\/__TIKDD_WEB_HOST__\$request_uri;/.test(nginxTemplate), "The apex-to-www canonical redirect is missing.");
  assert(/server_name __TIKDD_GATE_C_HOST__;[\s\S]*X-Robots-Tag "noindex, nofollow, noarchive" always;/.test(nginxTemplate), "The temporary Gate C host must be non-indexable.");
  assert(/default_server;[\s\S]*server_name _;[\s\S]*return 404;/.test(nginxTemplate), "Unknown Tunnel hostnames must fail closed.");
  assert(!/__TIKDD_ADMIN_HOST__|__TIKDD_ADMIN_HOST_PORT__|tikdd-admin/.test(nginxTemplate), "Admin must not be present in the Gate C public origin template.");
  assert(!/proxy_pass[^\n]*(?:4100|5432|6379)/.test(nginxTemplate), "A private service leaked into the Tunnel origin template.");
  assert(!/location[^\n]*(?:health|internal|diagnostic|canary|preflight|evidence|cleanup)/i.test(nginxTemplate), "An internal route leaked into the Tunnel origin template.");
  assert(/server_name __TIKDD_API_HOST__;[\s\S]*location \^~ \/v1\/[\s\S]*location \/ \{ return 404; \}/.test(nginxTemplate), "The API origin must expose only /v1/.");
  assert(/server_name __TIKDD_DELIVERY_HOST__;[\s\S]*location = \/v1\/deliveries[\s\S]*location \^~ \/d\/[\s\S]*location \/ \{ return 404; \}/.test(nginxTemplate), "The Delivery origin route allowlist changed unexpectedly.");

  const published = ["web", "api", "delivery", "admin-api"];
  for (const name of published) {
    assert(/^    ports:\r?\n      - 127\.0\.0\.1:/m.test(blocks[name]), `${name} must publish only on 127.0.0.1.`);
  }
  for (const name of allServices.filter((item) => !published.includes(item))) {
    assert(!/^    ports:/m.test(blocks[name]), `${name} must not publish a host port.`);
  }
  assert(!/(?:^|\s)(?:0\.0\.0\.0:|-[ "']*\$\{?[^\n]*:[0-9]+:[0-9]+)/m.test(compose), "A public or implicit host bind was found.");
  assert(!/^      - 127\.0\.0\.1:[^\n]*:4100$/m.test(compose), "Admin API port 4100 must never be published.");
  assert(/network_mode: service:admin-api/.test(blocks.admin), "Admin must share the admin-api network namespace.");
  assert(!/^    networks:/m.test(blocks.admin) && !/^    ports:/m.test(blocks.admin), "Admin cannot declare networks or ports with service network_mode.");
  assert(/127\.0\.0\.1:\$\{TIKDD_ADMIN_HOST_PORT[^\n]*:3001/.test(blocks["admin-api"]), "admin-api must own the Admin UI loopback publication.");
  assert(/^ADMIN_API_HOST=127\.0\.0\.1$/m.test(productionEnvironment), "Admin API must bind loopback in production configuration.");

  const expectedNetworks = {
    postgres: ["data"], redis: ["data"], web: ["data", "host-ingress"], api: ["data", "host-ingress"],
    worker: ["data", "provider-egress"], delivery: ["data", "provider-egress"],
    "admin-api": ["data", "provider-egress"], migration: ["data"],
    canary: ["data", "provider-egress"], evidence: ["data"], cleanup: ["data"],
    "cleanup-dry-run": ["data"], "admin-account": ["data"]
  };
  for (const [name, expected] of Object.entries(expectedNetworks)) {
    assert(JSON.stringify(declaredNetworks(blocks[name])) === JSON.stringify(expected), `${name} has incorrect Docker network membership.`);
  }
  assert(/network_mode: none/.test(blocks.preflight), "Preflight must have no Docker network.");

  for (const name of ["migration", "preflight", "canary", "evidence", "cleanup", "cleanup-dry-run", "admin-account"]) {
    assert(/restart: "no"/.test(blocks[name]), `${name} must remain a one-shot service.`);
  }
  assert(!/(?:cron|systemd timer|schedule daemon|sleep infinity|while true)/i.test(compose), "Work Item 17 scheduling leaked into Phase B.");
  for (const name of ["web", "api", "worker", "delivery", "admin-api", "admin"]) {
    assert(!/db:migrate/.test(blocks[name]), `${name} must not run migrations during startup.`);
  }
  assert(/command: \["pnpm", "db:migrate"\]/.test(blocks.migration), "The explicit migration runner is missing.");
  assert(/command: \["pnpm", "preflight:internal"\]/.test(blocks.preflight), "The explicit preflight runner is missing.");
  assert(/command: \["pnpm", "canary:run"\]/.test(blocks.canary), "The one-shot Canary command is missing.");
  assert(/command: \["pnpm", "evidence:run"\]/.test(blocks.evidence), "The one-shot evidence command is missing.");
  assert(/command: \["pnpm", "cleanup:run"\]/.test(blocks.cleanup), "The one-shot cleanup command is missing.");
  assert(/command: \["pnpm", "cleanup:dry-run"\]/.test(blocks["cleanup-dry-run"]), "The cleanup dry-run command is missing.");

  assert(/ENABLE_MOCK_PROVIDER=false/.test(productionEnvironment), "Mock Provider must be disabled in production.");
  assert(/PROVIDER_ROLLOUT_ENABLED=false/.test(productionEnvironment), "The foundation configuration must not grant rollout traffic.");
  assert(!/:latest(?:\s|$)/m.test(compose + productionEnvironment), "Mutable-only latest image identity is forbidden.");
  assert(/git-0000000000000000000000000000000000000000/.test(productionEnvironment), "The example must demonstrate full-SHA application image tags.");

  assert(/FROM production-dependencies AS service/.test(dockerfile), "tikdd-service image target is missing.");
  assert(/FROM production-dependencies AS web/.test(dockerfile), "tikdd-web image target is missing.");
  assert(/FROM production-dependencies AS admin/.test(dockerfile), "tikdd-admin image target is missing.");
  assert(/pnpm install --prod --frozen-lockfile/.test(dockerfile), "Production dependencies must exclude the development toolchain.");
  assert(/USER node/g.test(dockerfile), "Application images must run as a non-root user.");
  assert(/TIKDD_REQUIRED_SECRET_ENV_VARS/.test(secretEntrypoint) && !/echo.*value/i.test(secretEntrypoint), "The fail-closed secret bootstrap is missing or unsafe.");
  assert(/group_add:\r?\n    - \$\{TIKDD_SECRETS_GID:-1999\}/.test(compose), "Application containers need the reviewed supplemental secret GID.");
  assert(/user: "999:1000"/.test(blocks.redis), "TikDD Redis must run as the pinned non-root image identity.");
  assert(/entrypoint: \["\/bin\/sh", "\/usr\/local\/bin\/tikdd-redis-entrypoint"\]/.test(blocks.redis), "TikDD Redis must not depend on ignored Compose config executable modes.");
  assert(/test: \["CMD", "\/bin\/sh", "\/usr\/local\/bin\/tikdd-redis-healthcheck"\]/.test(blocks.redis), "TikDD Redis health checks must not depend on ignored Compose config executable modes.");
  assert(/read_only: true/.test(blocks.redis), "TikDD Redis needs a read-only root filesystem.");
  assert(/group_add:\r?\n      - \$\{TIKDD_SECRETS_GID:-1999\}/.test(blocks.redis), "TikDD Redis needs the supplemental secret-reader GID.");
  assert(/\/run\/tikdd-redis:rw,noexec,nosuid,size=16m,uid=999,gid=1000,mode=0700/.test(blocks.redis), "TikDD Redis needs a private writable runtime tmpfs.");
  assert(/cap_drop:\r?\n      - ALL/.test(blocks.redis), "TikDD Redis must drop Linux capabilities.");
  assert(/^TIKDD_SECRETS_GID=1999$/m.test(productionEnvironment), "The host secret GID contract is missing.");
  assert(!/github\.com\/example\/tikdd/.test(dockerfile), "OCI source metadata must identify the reviewed repository.");
  assert((dockerfile.match(/org\.opencontainers\.image\.source="https:\/\/github\.com\/wepuu\/tikdd"/g) ?? []).length === 3, "Every application image target needs the reviewed OCI source.");

  for (const name of ["web", "api", "worker", "delivery", "admin-api", "admin", "migration", "preflight", "canary", "evidence", "cleanup", "cleanup-dry-run"]) {
    assert(/^    secrets:/m.test(blocks[name]), `${name} is missing its explicit secret mount list.`);
  }
  assert(!/docker\s+system\s+prune|-a\s+--volumes/.test(releaseScript), "The release script contains destructive generic Docker cleanup.");
  assert(/TIKDD_STAGE_VERIFY_COMMAND/.test(releaseScript), "Shared-host stage verification is not mandatory.");
  assert(/TIKDD_INITIAL_EMPTY_DATABASE_CONFIRMED/.test(releaseScript), "The explicit fresh-empty database gate is missing.");
  assert(/Fresh-empty confirmation cannot be used for a non-empty PostgreSQL data directory/.test(releaseScript), "Fresh initialization does not fail closed for existing data.");
  const deployOrder = ["stage_service postgres", "stage_service redis", "stage_service api", "stage_service delivery", "stage_service worker", "stage_service web"];
  let previous = -1;
  for (const marker of deployOrder) {
    const current = releaseScript.indexOf(marker);
    assert(current > previous, `Incremental startup order is missing or invalid at ${marker}.`);
    previous = current;
  }
  const deployCase = releaseScript.match(/  deploy\)\n([\s\S]*?)\n    ;;/)?.[1] ?? "";
  assert(!/admin-api|admin-start|stage_service admin/.test(deployCase), "Admin must not start as part of the continuous deployment set.");
  assert(!/systemctl/.test(releaseScript), "Release automation must not manage host systemd services.");
  assert(!/^\s*service\s+(?:mysql|redis)(?:-server)?\b/m.test(releaseScript), "Release automation must not manage shared host datastores.");
  assert(!/docker\s+(?:stop|rm)\b/.test(releaseScript), "Release automation must not use raw Docker lifecycle commands.");

  return { serviceCount: allServices.length, networkCount: 3, publishedServiceCount: 4 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyWorkItem16Static();
  process.stdout.write(`${JSON.stringify({ event: "work_item_16_static_verification_complete", passed: true, ...result })}\n`);
}
