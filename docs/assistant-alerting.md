# Assistant IA – Plan d’alerting

Ce document décrit une proposition d’alerting minimal pour surveiller l’assistant IA en production. Il s’appuie sur les métriques et logs structurés exposés par la route Next.js (`app/api/assistant-demo`).

## Sources observées

1. **Endpoint métriques** – `GET /api/assistant-demo/metrics`
   - Fournit un snapshot JSON : `totalRequests`, `documentsRequests`, `statistiquesRequests`, `errors`, `llmSuccess`, `llmFallback`, `uptimeSeconds`.
   - À scrapper toutes les 60 s (Prometheus, Datadog agent HTTP, Grafana Agent, etc.).

2. **Logs structurés** – entrée console `assistant-telemetry`
   - Format JSON : `{ event, metrics, timestamp }`.
   - Les événements `response` donnent `durationMs`, `llmUsed`, `pieces`.
   - Les événements `error` exposent `status`, `message`.
   - Collecte recommandée via Filebeat/Fluent Bit -> Elastic, Loki, Datadog Logs…

## Règles d’alerte suggérées

| Objectif                            | Condition (sur 5 min)                                                                      | Action recommandée                   |
|------------------------------------|---------------------------------------------------------------------------------------------|--------------------------------------|
| **Erreur globale**                  | `errors / totalRequests > 0.05` ET `totalRequests >= 20`                                    | Pager équipe backend                 |
| **Fallback LLM trop fréquent**      | `llmFallback / (llmSuccess + llmFallback) > 0.2` ET `llmFallback >= 5`                      | Vérifier clés API / quota LLM        |
| **Temps de réponse élevé**          | P95 `durationMs` (event.response) > 4000 ms                                                 | Inspecter backend/LLM, scaler        |
| **Saturation rate limit**           | Nombre d’événements `error` avec `status = 429` > 10                                        | Ajuster `NEXT_PUBLIC_ASSISTANT_RATE_LIMIT` ou filtrer clients |
| **Uptime faible**                   | `uptimeSeconds` qui diminue (redémarrages fréquents)                                        | Investiguer crash/redeploy           |

> Les seuils sont à ajuster en fonction des volumes attendus. Les conditions combinent un ratio et un nombre absolu pour éviter le bruit en faible trafic.

## Exemple de configuration Prometheus + Alertmanager

```yaml
# scrape-config (Prometheus)
- job_name: 'assistant-metrics'
  metrics_path: /api/assistant-demo/metrics
  scrape_interval: 60s
  static_configs:
    - targets: ['next-app:3000']

# alerting rule
- alert: AssistantHighErrorRate
  expr: (sum(rate(assistant_errors_total[5m])) / sum(rate(assistant_total_requests[5m]))) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Erreur assistant IA > 5%"
    description: "{{ $value | humanizePercentage }} d'erreurs sur les 5 dernières minutes."
```

> `assistant_errors_total` et `assistant_total_requests` correspondent à des métriques à mapper depuis les champs JSON. Un exporter simple (Node/Go) peut transformer le JSON en métriques Prometheus.

## Dashboards recommandés

- **Panel 1** : Requêtes/minute par intent (`documents` vs `statistiques`).
- **Panel 2** : Ratio succès LLM / fallback.
- **Panel 3** : Latence (P50/P95) des événements `response`.
- **Panel 4** : Top messages d’erreur (`event.error.message`).
- **Panel 5** : Uptime et redémarrages.

## Processus d’escalade

1. **Alerting automatique** -> Canal Slack `#ops-assistant` + pager d’astreinte.
2. **Runbook rapide** :
   - Vérifier `/api/assistant-demo/metrics`.
   - Consulter logs `assistant-telemetry` (outil de log ou commande `npm run dev | npm run logs:assistant`).
   - Pour les erreurs LLM : valider clé API, quota, statut fournisseur.
   - Pour les lenteurs : vérifier charge backend (CPU/mémoire), disponibilité FAISS, latence réseau.
3. **Communication produit** : si fallback > 50 % pendant > 30 min, informer l’équipe métier (qualité des réponses dégradée).

---

Ce plan constitue une base. Adapter les seuils et canaux en fonction des contraintes d’exploitation réelles (SLA, volumétrie, disponibilité du personnel d’astreinte).
