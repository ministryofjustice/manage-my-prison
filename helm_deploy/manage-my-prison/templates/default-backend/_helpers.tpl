{{/* Labels used to select default-backend resources: mimics generic-service selector labels */}}
{{- define "default-backend.selector-labels" -}}
app: default-backend
release: {{ .Release.Name }}
{{- end }}
