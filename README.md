# FlowForge — DevOps Capstone

FlowForge is a project and task management web application used to demonstrate an automated DevOps workflow. The project combines application development, containerization, continuous integration and deployment, deployment rollback, and monitoring.

## Key Features

### Application
- User registration, login, and logout
- Private projects and account-specific tasks
- Task creation, editing, deletion, and status updates
- Task priorities, due dates, search, and filters
- Dashboard totals and project completion progress
- Health, readiness, application information, and metrics endpoints

### DevOps
- Automated CI/CD using Jenkins
- GitHub-based source control and webhook-triggered builds
- Docker image build and containerized deployment
- Automated application tests
- Versioned deployments and automatic rollback on deployment failure
- Prometheus metrics collection
- Grafana dashboards for application monitoring

## Technology Stack

| Area | Technologies |
|---|---|
| Application | Node.js, Express, HTML, CSS, JavaScript |
| Database | SQLite |
| Containerization | Docker, Docker Compose |
| CI/CD | Jenkins, GitHub |
| Monitoring | Prometheus, Grafana |
| Testing | npm test and project test suite |

## Architecture

```text
Developer
   |
   v
GitHub Repository
   |
   | Push / Webhook
   v
Jenkins Pipeline
   |
   +--> Checkout source code
   +--> Install dependencies
   +--> Run automated tests
   +--> Prepare rollback state
   +--> Build versioned Docker image
   +--> Deploy application
   +--> Check application health
   |
   +--> Roll back if deployment fails
   |
   v
FlowForge Application
   |
   +--> Health and metrics endpoints
   |
   v
Prometheus ------> Grafana Dashboard
## Prerequisites
- Git, Node.js, npm, Docker Desktop, and Jenkins are required.

## Run Locally

Install dependencies and configure the local environment:

```bash
npm ci
cp .env.example .env
```

Configure the required environment variables in `.env`, including a strong, unique `SESSION_SECRET`. Start the application with:

```bash
npm start
```

Open http://localhost:3000.

## Run with Docker Compose
Configure the required variables in `.env`, including `GRAFANA_ADMIN_PASSWORD`.
```bash
docker compose up --build -d
docker compose ps
```

| Service | URL |
|---|---|
| FlowForge | http://localhost:3000 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |

Stop the services with `docker compose down`. Avoid `docker compose down -v` unless you intend to delete the persistent volumes and their data.

## Jenkins CI/CD Pipeline

The Jenkins pipeline is defined in the `Jenkinsfile` and runs automated build and deployment steps.

1. Configure a Jenkins Pipeline job using Pipeline script from SCM.
2. Select Git and enter the GitHub repository URL.
3. Set the branch to `main` and script path to `Jenkinsfile`.
4. Ensure the Jenkins agent has Git, Node.js/npm, and Docker access.
5. Add a Jenkins Secret text credential with ID `grafana-admin-password`.
6. Configure the GitHub webhook and the corresponding Jenkins trigger.
7. Run a build and review the Jenkins console output.

### Pipeline stages

- Checkout source code
- Install dependencies and run automated tests
- Prepare rollback state
- Build a versioned Docker image
- Deploy the application and verify its health
- Attempt rollback if deployment verification fails

The `grafana-admin-password` credential must match the Grafana administrator password used by the deployment. Never commit passwords, credentials, or the local `.env` file.

## Rollback Strategy

The pipeline retains a previously working application image so it can attempt to restore the earlier version when a deployment fails. Rollback depends on the previous image and persistent application data remaining available. Database schema changes may require separate migration and recovery procedures.

## API and Health Checks

Check the application health, readiness, information, and metrics endpoints:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
curl http://localhost:3000/api/info
curl http://localhost:3000/api/metrics
```

Open Prometheus at http://localhost:9090 and check **Status → Targets** to verify the FlowForge scrape target. Open Grafana at http://localhost:3001 to view the monitoring dashboard.

## Troubleshooting

### Application is unavailable
```bash
docker compose ps
docker compose logs --tail=100 taskflow
curl http://localhost:3000/api/health
```

### Prometheus target is down
- Confirm that the application container is running.
- Verify that the metrics endpoint is reachable from the Compose network.
- Inspect **Status → Targets** in Prometheus.

### Grafana fails to start
- Confirm that `GRAFANA_ADMIN_PASSWORD` is configured.
- For Jenkins deployments, verify that the `grafana-admin-password` credential exists.
```bash
docker compose logs --tail=100 grafana
```

### Jenkins build fails
Review the failed pipeline stage and console output. Check repository settings, credentials, environment variables, dependencies, and Docker daemon access.

## Security and Limitations

This is a learning project, not a production-hardened service. Before real-world deployment, review HTTPS, session storage, CSRF protection, rate limiting, access control, database backups, secret management, and infrastructure hardening.

Never commit `.env` files, credentials, or database files.

## Demo Flow

1. Register and sign in to FlowForge.
2. Create a project and add tasks.
3. Update task statuses and demonstrate dashboard progress.
4. Show the health and metrics endpoints.
5. Push a change to GitHub and demonstrate the Jenkins webhook.
6. Show automated tests and pipeline stages.
7. Demonstrate rollback in a controlled test environment.
8. Show Prometheus targets and the Grafana dashboard.

---

**Project:** FlowForge DevOps Capstone
**Repository:** https://github.com/bhavesh/flowforge-devops-capstone

## Repository Structure

```text
Jenkinsfile
Dockerfile
docker-compose.yml
monitoring/prometheus.yml
server.js
public/
src/
test/
```
