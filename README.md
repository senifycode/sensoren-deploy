# Sensoren-Server Deployment

Monorepo deployment configuration for the Sensoren IoT platform using Git submodules.

## Architecture

This repository orchestrates 4 microservices:

- **sensoren-server**: SvelteKit frontend + API (HTTP port 80)
- **broker-service**: MQTT broker for IoT devices (ports 1883, 8883, gRPC 8081)
- **websocket-service**: Real-time WebSocket server (gRPC 8091)
- **backup-service**: Database backup management (gRPC 8101)

All services communicate via:
- Docker bridge network with static IPs (172.20.0.0/16)
- gRPC for inter-service communication
- Shared external MySQL database

## Prerequisites

- External MySQL database (accessible from Docker host)
- Coolify instance for deployment
- Git repositories for all 4 services
- Each service has `shared-utils` as a Git submodule

## Quick Start

### 1. Clone Repository with Submodules

```bash
git clone --recursive https://github.com/YOUR_ORG/sensoren-deploy.git
cd sensoren-deploy
```

If you already cloned without `--recursive`:
```bash
git submodule update --init --recursive
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual values
```

Required variables:
- `DATABASE_URL`: MySQL connection string
- `ENCRYPTION_KEY`: 32-character encryption key
- `MQTT_PASSWORD`: Secure password for MQTT broker
- `PLANE_API_KEY`: API key for Plane integration
- `ORIGIN`: Your production domain

### 3. Create Volume Directories

```bash
mkdir -p volumes/images volumes/ssl volumes/backups
```

For SSL certificates (if not auto-generated):
```bash
# Place your MQTT SSL certificates in volumes/ssl/
cp /path/to/cert.pem volumes/ssl/
cp /path/to/key.pem volumes/ssl/
```

### 4. Local Testing (Optional)

```bash
# Build all services
docker compose build

# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

## Deployment to Coolify

### Step 1: Create New Resource

1. Go to Coolify Dashboard → **Resources** → **New Resource**
2. Select **Docker Compose**
3. Configure:
   - **Name**: `sensoren-server`
   - **Repository URL**: `https://github.com/YOUR_ORG/sensoren-deploy.git`
   - **Branch**: `main`
   - **Compose File**: `docker-compose.yml`

### Step 2: Environment Variables

Add these in Coolify UI (or import from `.env.example`):

```env
NODE_ENV=production
ORIGIN=https://sensore.senify.de
SERVICE_PORT=80
DATABASE_URL=mysql://user:password@mysql-host:3306/senify
BCRYPT_ROUNDS=12
ENCRYPTION_KEY=your-32-char-key
MQTT_PASSWORD=your-mqtt-password
PLANE_API_KEY=your-api-key
MQTT_PORT=8883
```

### Step 3: Persistent Storage

Configure volume mappings in Coolify:
- **Source**: `./volumes/images` → **Destination**: `/images`
- **Source**: `./volumes/backups` → **Destination**: `/backups`
- **Source**: `./volumes/ssl` → **Destination**: `/ssl` (read-only)

### Step 4: Domain & Ports

- **Primary Domain**: `sensore.senify.de` (points to port 80)
- **MQTT Ports**: Open ports 1883 and 8883 on your server firewall
  - IoT devices connect to: `mqtt://sensore.senify.de:8883`

### Step 5: Deploy

Click **Deploy** in Coolify. It will:
1. Clone repository with submodules (`--recursive`)
2. Build all 4 Docker images (takes 5-10 minutes)
3. Start containers in dependency order
4. Run health checks
5. Expose port 80 through Traefik proxy

### Step 6: Post-Deployment

Run database migrations:
```bash
docker exec sensoren-server bun run prisma migrate deploy
```

Verify services are healthy:
```bash
docker compose ps
docker compose logs sensoren-server
```

## Network Architecture

```
Internet
    │
    ├─────> Port 80 ────────> sensoren-server (172.20.0.20:3000)
    │                              │
    │                              ├─> gRPC → broker-service (172.20.0.10:8081)
    │                              ├─> gRPC → websocket-service (172.20.0.11:8091)
    │                              └─> gRPC → backup-service (172.20.0.12:8101)
    │
    └─────> Port 8883 ─────> broker-service (172.20.0.10:8883)
                                  │
                                  └─> gRPC → websocket-service (172.20.0.11:8091)
                                       │
                                       └─> WebSocket → Web Browsers

External MySQL <──── All services via DATABASE_URL
```

## Updating Services

### Update All Submodules to Latest

```bash
git submodule update --remote --merge
git add .
git commit -m "Update all services to latest"
git push
```

Coolify will auto-deploy if webhook is configured.

### Update Specific Service

```bash
cd broker-service
git pull origin main
cd ..
git add broker-service
git commit -m "Update broker-service"
git push
```

### Update shared-utils Across All Services

```bash
# Update shared-utils in each service
git submodule foreach 'git submodule update --remote shared-utils'
git add .
git commit -m "Update shared-utils in all services"
git push
```

## Monitoring & Troubleshooting

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f sensoren-server
docker compose logs -f broker-service
```

### Health Checks

All services expose `/health` endpoints:
- Sensoren-server: `http://localhost:3000` (via curl in healthcheck)
- Broker: `http://localhost:8081/health`
- WebSocket: `http://localhost:8091/health`
- Backup: `http://localhost:8101/health`

### Common Issues

#### gRPC Connection Refused
```bash
# Check Docker network
docker network inspect sensoren-deploy_sensoren-network

# Verify IPs match docker-compose.yml
docker inspect broker-service | grep IPAddress
```

**Solution**: Ensure environment variables match:
- `BROKER_RPC_HOST=172.20.0.10`
- `WSS_RPC_HOST=172.20.0.11`
- `BACKUP_RPC_HOST=172.20.0.12`

#### Database Connection Failed
```bash
# Test from container
docker exec sensoren-server bun run prisma db pull
```

**Solutions**:
- For MySQL on Docker host: Use `host.docker.internal:3306`
- For external MySQL: Verify firewall allows connections
- Check `DATABASE_URL` format: `mysql://user:pass@host:port/database`

#### Submodules Not Initialized
```bash
# Initialize all submodules including nested ones
git submodule update --init --recursive
```

#### Image Storage Permissions
```bash
# Fix permissions if images can't be saved
docker exec sensoren-server chown -R bun:bun /images
```

## Manual Operations

### Rebuild Specific Service
```bash
docker compose build --no-cache broker-service
docker compose up -d broker-service
```

### Access Service Shell
```bash
docker exec -it sensoren-server /bin/sh
docker exec -it broker-service /bin/sh
```

### Run Database Migrations
```bash
docker exec sensoren-server bun run prisma migrate deploy
```

### Backup Database
```bash
# Trigger backup via backup-service
# (Assuming backup-service has a trigger endpoint)
docker exec backup-service bun run backup:create
```

## Development Workflow

### Local Development with Docker
```bash
# Start all services
docker compose up -d

# Watch logs
docker compose logs -f sensoren-server

# Make changes in submodules
cd sensoren-server
git pull origin feature-branch
cd ..

# Rebuild and restart
docker compose build sensoren-server
docker compose up -d sensoren-server
```

### Switching Service Versions
```bash
# Pin to specific commit
cd broker-service
git checkout abc123
cd ..
git add broker-service
git commit -m "Pin broker-service to abc123"
```

## Repository Structure

```
sensoren-deploy/
├── docker-compose.yml        # Master orchestration
├── .env.example              # Environment template
├── .gitignore                # Ignore volumes and .env
├── README.md                 # This file
│
├── sensoren-server/          # Git submodule
│   ├── DockerfileBUN
│   ├── package.json
│   ├── src/
│   └── shared-utils/         # Nested submodule
│
├── broker-service/           # Git submodule
│   ├── Dockerfile
│   ├── src/
│   └── shared-utils/         # Nested submodule
│
├── websocket-service/        # Git submodule
│   ├── Dockerfile
│   ├── src/
│   └── shared-utils/         # Nested submodule
│
├── backup-service/           # Git submodule
│   ├── Dockerfile
│   ├── src/
│   └── shared-utils/         # Nested submodule
│
└── volumes/                  # Persistent storage (gitignored)
    ├── images/               # User uploads, profile pictures
    ├── ssl/                  # MQTT SSL certificates
    └── backups/              # Database backups
```

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Coolify

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: recursive

      - name: Trigger Coolify Deployment
        run: |
          curl -X POST ${{ secrets.COOLIFY_WEBHOOK_URL }}
```

## Security Considerations

- Never commit `.env` file (use `.env.example` template)
- Rotate `ENCRYPTION_KEY` and `MQTT_PASSWORD` regularly
- Use strong passwords for MySQL database
- Keep SSL certificates in `volumes/ssl/` (not in git)
- Review submodule commits before updating production

## Support

For issues or questions:
- Check service logs: `docker compose logs -f [service-name]`
- Review Coolify deployment logs
- Verify environment variables are set correctly
- Ensure all submodules are initialized: `git submodule status`

## License

See individual service repositories for license information.
