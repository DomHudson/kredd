# <img src="https://github.com/DomHudson/kredd/blob/main/frontend/public/favicon.png" height=48 /> Kredd

## How it works

#### Step 1 - Describe what you're looking for
Tell Kredd what pitches you receive — AI generates smart filter questions automatically.
<img src="https://github.com/DomHudson/kredd/blob/main/pictures/step-describe-BvboasF5.png?raw=true" height=300 />

#### Step 2 - Share your unique link
Drop it in your LinkedIn, email signature, or website — anyone can pitch you through it.
<img src="https://github.com/DomHudson/kredd/blob/main/pictures/step-share-BgtMRjtO.png?raw=true" height=300 />

#### Step 3 - Review ranked submissions
Every submission is scored, summarized, and surfaced with follow-up suggestions.
<img src="https://github.com/DomHudson/kredd/blob/main/pictures/step-review-YI7VtQ66.png?raw=true" height=300 />


## Installation Instructions
1. Install [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/)
2. Create a `.env` file in the root directory of the repository. This is used to store deployment-specific environment variables. Populate it with the following:
```
KREDD_DB_NAME=kredd
KREDD_DB_USER=kredd
KREDD_DB_PASSWORD="add-a-long-password-here"
KREDD_DJANGO_DEBUG=true
KREDD_DJANGO_SECRET_KEY="add-a-different-long-password-here"
KREDD_GMAIL_APP_PASSWORD="add-a-different-long-password-here"
KREDD_GMAIL_SMTP_HOST=smtp.gmail.com
KREDD_MINIO_ACCESS_KEY=kredd_minio
KREDD_MINIO_SECRET_KEY="add-a-different-long-password-here"
KREDD_MINIO_BUCKET=attachments
KREDD_RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
KREDD_SITE_URL=http://127.0.0.1
```
3. Start all services with `docker compose up`. If you've made code changes, make sure to include the `--build` parameter.

4. Visit `http://localhost` for a local installation of Kredd.

## Development - Git Hooks
First install [Ruff](https://docs.astral.sh/ruff/):
```bash
sudo snap install ruff
```

Then, configure git to use the `.githooks` directory. This will trigger the pre-commit formatting hook to run on git commit.
```bash
git config core.hooksPath .githooks
```

## Environment Variables
Following [Twelve-Factor App](https://12factor.net/) principles, Kredd configuration is stored in environment variables.

| Variable                  | Default                              | Description                                                              |
| ------------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| `KREDD_CERTBOT_DOMAIN`    | None                                 | Domain name to issue a Let's Encrypt certificate for (e.g. `kredd.io`). Leave unset for HTTP-only local development. |
| `KREDD_CERTBOT_EMAIL`     | None                                 | Email address for Let's Encrypt certificate registration. When set alongside `KREDD_CERTBOT_DOMAIN`, HTTPS is enabled automatically. |
| `KREDD_CLAUDE_API_KEY`            | None                         | API key for the Anthropic Claude API. If left empty, LLM-based relevance reasoning is skipped. |
| `KREDD_CLAUDE_MODEL`              | `claude-haiku-4-5-20251001`        | Claude model used to generate outreach fit reasoning.                    |
| `KREDD_DB_NAME`           | `kredd`                              | Name of the database used by the application.                            |
| `KREDD_DB_USER`           | `kredd`                              | Database username for authentication.                                    |
| `KREDD_DB_PASSWORD`       | `add-a-long-password-here`           | Password for the database user.                                          |
| `KREDD_DJANGO_DEBUG`      | `true`                               | Enables or disables Django debug mode (should be `false` in production). |
| `KREDD_DJANGO_SECRET_KEY` | `add-a-different-long-password-here` | Secret key used by Django for cryptographic signing.                     |
| `KREDD_GMAIL_ADDRESS`     | `hello@kredd.io`                     | Email address to use with Gmail's SMTP server.                           |
| `KREDD_GMAIL_APP_PASSWORD`| None                                 | [Application key](https://myaccount.google.com/apppasswords) for Gmail SMTP authentication. If left empty, no email notifications are sent. |
| `KREDD_GMAIL_PORT`        | `587`                                | Port to use for SMTP authentication. For SSL, use 465. For TLS, use 587. |
| `KREDD_GMAIL_SMTP_HOST`   | `smtp.gmail.com`                     | SMTP server hostname used to send outgoing email.                        |
| `KREDD_MAX_ATTACHMENT_BYTES` | `10485760` (10MB)                 | Maximum size (in bytes) per outreach attachment.                         |
| `KREDD_MINIO_ACCESS_KEY`  | `kredd_minio`                        | Access key (username) for MinIO object storage.                          |
| `KREDD_MINIO_SECRET_KEY`  | `add-a-different-long-password-here` | Secret key (password) for MinIO access.                                  |
| `KREDD_MINIO_BUCKET`      | `attachments`                        | Name of the MinIO bucket used to store uploaded attachments.             |
| `KREDD_RABBITMQ_URL`      | `amqp://guest:guest@rabbitmq:5672/`  | Connection URL for the RabbitMQ message broker.                          |
| `KREDD_PASSWORD_RESET_TTL_SECONDS` | `86400` (24h)               | Lifetime of a password reset token, in seconds.                          |
| `KREDD_SEMANTIC_SIMILARITY_MODEL` | `/app/ml_models/stsb-TinyBERT-L4` | Model to use for semantic similarity cross encoding. Either a path to directory within the worker container, or a name of the model. If a name is provided, the worker container will attempt to download the model as the service starts.  |
| `KREDD_SITE_URL`          | `http://127.0.0.1`                   | Base URL where the application is hosted.                                |

## Services

The Kredd application requires a number of different services to run. Each one has precise responsibilities. The service definitions are in `docker-compose.yml`.

| Service    | Description                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `db`       | MySQL database service that stores all persistent application data. It uses a Docker volume (`db_data`) for durability and includes a healthcheck to ensure readiness before dependent services start. |
| `rabbitmq` | Message broker used for handling asynchronous tasks and background job queues. Ensures reliable communication between the API and worker services.                                                     |
| `minio`    | Object storage service compatible with S3 APIs, used to store file uploads and attachments. Data is persisted via the `minio_data` volume.                                                             |
| `migrate`  | One-off service that runs Django database migrations (`manage.py migrate`) to set up or update the database schema before the application starts.                                                      |
| `api`      | Main Django backend service that exposes the application’s API, handles requests, and coordinates with the database, message broker, and object storage.                                               |
| `worker`   | Background worker service that processes asynchronous jobs (i.e., via RabbitMQ), such as sending emails or handling long-running ML tasks.                                                                |
| `nginx`    | Frontend web server that serves static assets and acts as a reverse proxy to the API service. In production (when `KREDD_CERTBOT_DOMAIN` is set), automatically obtains a Let's Encrypt certificate and serves traffic over HTTPS on port 443, redirecting HTTP. |



## Making Migrations
The simplest way to do this, is to use a Python environment outside of Docker.

1. Create and activate a virtual environment:
```bash
$ python3 -m venv env
$ . env/bin/activate
```

2. Install the Python requirements into your virtual environment:
```bash
$ pip install -r requirements
```

3. Generate the migrations
```bash
python manage.py makemigrations
```
