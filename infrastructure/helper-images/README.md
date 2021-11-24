Manage my prison – Helper images
================================

Subfolders here with Dockerfiles are automatically built by Github Actions and pushed into ECR.

- `default-backend`: This image serves simple, static and fully self-contained error and maintenance pages.
  Its primary use is as the default backend for the application’s kubernetes ingress to respond in case particular
  HTTP error codes are produced by the application/ingress. For example, if the connecting client is forbidden due
  to IP address restrictions, an informative page can be shown in place of the generic "403 Forbidden" message
  served by the default nginx ingress controller.
- `port-forward`: This small image can be used to forward TCP services only accessible from within the cluster.
  For example, it can be used to connect Elasticache Redis to a local port.
