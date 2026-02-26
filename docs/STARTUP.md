# Urban Pulse — Startup Protocol

## Prerequisites
- OrbStack running (Docker services)
- Xcode installed, simulator available

---

## 1. Start Infrastructure

```bash
cd ~/projects/urban-pulse
docker compose up -d   # postgres, redis, minio
```

Verify:
```bash
docker compose ps      # all 3 healthy
```

## 2. Start API Server

```bash
cd apps/api
npx tsx src/index.ts
```

Verify: `curl http://localhost:3000/api/health` → `{"status":"ok"}`

## 3. Start Metro Bundler

**New terminal:**
```bash
cd apps/mobile
npx expo start --port 8081 --clear
```

> ⚠️ Do **NOT** use `--dev-client` flag (expo-dev-client isn't installed).

Wait until you see `Logs for your project will appear below` before launching the simulator.

## 4. Launch iOS Simulator

```bash
xcrun simctl boot EE761761-0BD3-43AA-BC89-35DAE1953CE0
open -a Simulator
```

Then in the Metro terminal, press `i` to build & install on the simulator.

## 5. Verify App

- Login screen should appear (email + password fields, Register link)
- Use dev credentials or register a new account

---

## Troubleshooting

### Black/White Screen
Metro probably died. Check if port 8081 is alive:
```bash
lsof -i :8081
```
If nothing, restart Metro (step 3).

### Pod Issues After Prebuild
If you ran `npx expo prebuild --clean`, you **must** re-apply the lazy fix:
```bash
# In apps/mobile/ios/UrbanPulse/AppDelegate.mm
# Change: self.moduleName = @"main"; (around line 10)
# Ensure: launchOptions:self.launchOptions]; has lazy=false
```
Look for `bundleURL` method — make sure it does NOT use `lazy:true`.

### JS Errors (No Metro Console)
Without expo-dev-client, JS logs don't show in Metro. Use:
```bash
xcrun simctl spawn EE761761-0BD3-43AA-BC89-35DAE1953CE0 log show --last 30s --style compact | grep "UrbanPulse.*javascript"
```

### Auth Not Working
Current auth is **mock mode**. Known race condition: signing in may get immediately cleared. This is the next bug to fix.

---

## Ports Reference
| Service  | Port |
|----------|------|
| API      | 3000 |
| Metro    | 8081 |
| Postgres | 5432 |
| Redis    | 6379 |
| MinIO    | 9000 / 9001 (console) |

## Quick One-Liner (all infra)
```bash
cd ~/projects/urban-pulse && docker compose up -d && cd apps/api && npx tsx src/index.ts &
```
Then in another terminal: `cd ~/projects/urban-pulse/apps/mobile && npx expo start --port 8081 --clear`
