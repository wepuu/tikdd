# Work Item 123: Cobalt secret permission repair

## Scope

The first WI122 runtime probe showed that the official Cobalt image runs as the non-root `node`
user. The Docker secret bind mount was `root:root 0600`, so Cobalt could not watch or read its
key file and became unhealthy before any provider request.

This repair adds the existing `TIKDD_SECRETS_GID` supplementary group to `cobalt-api`. The VPS
key file is provisioned as `root:tikdd-secrets 0640`. No public port, API permission, provider
gate or Worker environment value is changed.

## Verification

After deployment, confirm from the container that the key file is readable and that the health
check passes. Then run the closed-gate operation:

```text
TIKDD_RELEASE_ENV=/etc/tikdd/production.env \
  sh scripts/production-release.sh cobalt-runtime-probe
```

The probe must report `service=private auth=verified ok=available gates=closed`. If it fails,
stop the Cobalt profile and keep all three gates false. Do not weaken the file to world-readable,
run Cobalt as root, or expose the API outside `provider-egress`.
