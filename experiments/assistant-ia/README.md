# Assistant IA – Espace d'expérimentation

Cet espace contient les travaux de recherche et développement liés à l'assistante IA pour la plateforme d'archivage.

## Structure

- `data/` : données factices (métadonnées, procédures, documents anonymisés).
- `build_index.py` : script de génération du corpus JSON pour les tests RAG.
- `indexes/` : sortie du script (ignorée par Git).
- `service.py` : API FastAPI minimale utilisant TF-IDF + cosinus.
- `requirements.txt` : dépendances spécifiques aux expérimentations IA.

> ⚠️ Cet espace est isolé pour ne pas impacter le développement principal.

## Prise en main rapide

1. **Installer les dépendances IA (en environnement virtuel dédié)**
   ```bash
   pip install -r experiments/assistant-ia/requirements.txt
   ```

2. **Générer le corpus de test**
   ```bash
   py experiments/assistant-ia/build_index.py
   ```
   Le fichier `indexes/corpus.json` est créé à partir des données factices.

3. **Lancer le service FastAPI (optionnel)**
   ```bash
   uvicorn experiments.assistant-ia.service:app --reload
   ```
   Endpoint disponible sur `POST http://localhost:8000/query`.

4. **Tester l’interface Next.js**
   - Démarrer l’application (`npm run dev`).
   - Visiter `/assistant-demo`.
   - Poser une question : la route `app/api/assistant-demo/route.ts` lit le corpus pour illustrer le flux RAG.

## Prochaines étapes possibles

- Ajouter d’autres documents factices (PDF, images) et brancher un OCR.
- Expérimenter un index vectoriel (FAISS, Milvus) et un LLM.
- Implémenter la prise en compte des rôles pour filtrer les réponses.
