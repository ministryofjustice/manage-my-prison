Manage my prison
================

**Not currently being developed**

This typescript-based service will provide prison staff with insights and charts to help them manage their residents.
It will not provide a consumable api to other services.

It connects to several dependency services:

- [HMPPS Auth](https://github.com/ministryofjustice/hmpps-auth) – to authenticate users
- redis – to store user sessions
- AWS S3 – to load source data (mocked when running locally)
- AWS Athena – to build aggregated data (not available locally)

## Running the application locally

Requirements:

- docker
- node v16 to run the application in auto-restarting mode
- helm v3 to manage application releases

### …fully in docker

`docker compose up` will build and run the application and dependency services,
but it will require restaring if any code changes.

### …with only services in docker

By running the application with node outside of docker,
auto-restarting is enabled so that changes to server code and front-end assets are applied immediately.

`docker compose up --scale app=0` will run only the dependency services.

Before _first_ run, node packages need to be installed: `npm install`.

The application needs a set of environment variables to run – they are most easily set up by creating a ".env" file.
The minimal defaults can be copied from ".env.sample".

The application is then run with `npm run start:dev`.

### Logging in / HMPPS Auth

When running locally, HMPPS Auth will be seeded with `MMP_USER` account with password `password123456`
that can access this application.

In all hosted environments, users will need their own account in the matching HMPPS Auth instance.

### Mocked AWS S3 – Minio

When running locally using docker compose, AWS S3 is mocked using [Minio](https://github.com/minio/minio)
by provisioned a bucket automatically with files seeded from "/data" directory of this repository.

Access the minio console and view bucket contents: http://localhost:9001/

You will be prompted to enter the test minio access key and secret defined in the docker-compose.yml file.

### AWS Athena

AWS Athena is not mocked when running locally.
Add `dev` environment access key and secret to your personal ".env" file.

## Testing locally

`npm test` runs unit tests – it does not require dependency services to be running.

`npm run lint` runs code linters to ensure style standards are maintained.

`npm run typecheck` runs typescript compiler to ensure all interfaces are used appropriately.

To run integration tests, these need to be run in concert:

- `docker compose -f docker-compose-test.yml up` to start dependency services
- `npm run start-feature` to run the application or `npm run start-feature:dev` in auto-restarting mode
- `npm run int-test` to perform headless tests or `npm run int-test-ui` with the cypress UI

NB: husky installs a git hook to run unit tests and auto-linting using prettier prior to committing changes.

## Automated testing

CircleCI runs all the above types of tests (linting, type-checking, unit and integration testing)
when changed are pushed to github and also periodically performs:

- security and vulnerability testing using Trivy and Veracode
- a check for outdated npm packages for a very small subset of dependencies
  (see "Run check outdated npm packages" step in CircleCI config)

Github @dependabot is set up to try updating packages as updates are released.

Helm charts are also linted by CircleCI.

## Hosting and deployment

This service is hosted on [Cloud Platform](https://user-guide.cloud-platform.service.justice.gov.uk/)
and automatically deployed to the `dev` environment when commits are pushed to the main branch.

Helm is used to manage the deployment of all relevant kubernetes resources
and uses [HMPPS helm charts](https://ministryofjustice.github.io/hmpps-helm-charts/).

See "/helm_deploy/README.md" for more information.

## Scripts

Scripts that are available both locally and in the built/deployed application are stored in "/bin".

A suite of command line shortcuts exist in "/infrastructure/cli" for common tasks,
particularly those related to infrastructure hosted in Cloud Platform or AWS.
These do not form part of the built/deployed application.

## Repository template

This repository was cloned from [HMPPS Typescript Template](https://github.com/ministryofjustice/hmpps-template-typescript/),
but has subsequently diverged. Notably:

- all javascript files have been converted to typescript (including scripts and frontend assets) to benefit from typechecking
- a kubernetes default backend has been added to serve customised error pages
- a set of command line shortcuts has been added to manage infrastructure and resources in AWS

[Information about the source template project](https://dsdmoj.atlassian.net/wiki/spaces/NDSS/pages/3488677932/Typescript+template+project).

## Misc

[Ministry of Justice security policy](https://github.com/ministryofjustice/manage-my-prison/security/policy).
