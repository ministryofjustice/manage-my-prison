Manage my prison – Deployment
=============================

This service is hosted on [Cloud Platform](https://user-guide.cloud-platform.service.justice.gov.uk/)
and automatically deployed to the `dev` environment when commits are pushed to the main branch.

At present, only the `dev` environment exists in kubernetes namespace
[`manage-my-prison-dev`](https://github.com/ministryofjustice/cloud-platform-environments/tree/main/namespaces/live.cloud-platform.service.justice.gov.uk/manage-my-prison-dev).

Helm is used to manage the deployment of all relevant kubernetes resources
and uses [HMPPS helm charts](https://ministryofjustice.github.io/hmpps-helm-charts/).

## Components

### Centrally managed by HMPPS Digital

- HMPPS Auth – used to authenticate users
- Quay.io – used to store docker images of the main application

### Managed through Cloud Platform

- AWS Elasticache Redis – used to store helper docker images
- AWS ECR
- AWS S3
- AWS Athena

### Managed by Helm using charts in this repository

- Kubernetes deployments and services
  - `manage-my-prison` – the main application
  - `default-backend` – the default backend used to serve customised error messages
- Kubernetes ingress for `manage-my-prison`
- Kubernetes job to setup tables in Athena for `manage-my-prison`

## Command line interface

While the `helm` command can be used to interrogate and manage the application release,
the easiest way to do it is by using the command shortcuts in "/infrastructure/cli";
they also provide ways to manage AWS resources.

Examples:

```shell
# view status of current releases
./index.ts helm status [environment]

# list past releases
./index.ts helm history [environment]

# roll back to a past release
./index.ts helm rollback [environment] -1

# check whether the latest HMPPS helm charts are used
./index.ts helm dependencies

# debug rendered helm chart
./index.ts helm template [environment]

# plus many more, see --help for more options
```

If using `helm`, be sure to:

- use version 3
- add HMPPS helm chart repo `helm repo add hmpps-helm-charts https://ministryofjustice.github.io/hmpps-helm-charts`
