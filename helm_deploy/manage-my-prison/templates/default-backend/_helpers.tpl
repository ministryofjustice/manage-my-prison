{{/* Labels set on all default-backend resources */}}
{{- define "default-backend.labels" -}}
{{ include "default-backend.selector-labels" . }}
helm.sh/chart: {{ include "manage-my-prison.chart" . }}
{{- $appVersion := index .Values "generic-service" "image" "tag" }}
{{- if $appVersion }}
app.kubernetes.io/version: {{ $appVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: {{ include "generic-service.name" . }}
{{- end }}

{{/* Labels used to select default-backend resources */}}
{{- define "default-backend.selector-labels" -}}
app: default-backend
release: {{ .Release.Name }}
{{- end }}
