{{/* Labels set on all default-backend resources */}}
{{- define "default-backend.labels" -}}
{{ include "default-backend.selector-labels" . }}
helm.sh/chart: {{ include "manage-my-prison.chart" . }}
{{- if (.Values.image | default dict).tag }}
app.kubernetes.io/version: {{ .Values.image.tag | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: {{ include "generic-service.name" . }}
{{- end }}

{{/* Labels used to select default-backend resources */}}
{{- define "default-backend.selector-labels" -}}
app: default-backend
release: {{ .Release.Name }}
{{- end }}
