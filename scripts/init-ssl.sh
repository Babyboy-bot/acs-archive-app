#!/bin/bash
# =============================================================================
# Script d'initialisation SSL - À exécuter UNE SEULE FOIS sur le serveur
# pour obtenir les vrais certificats Let's Encrypt.
#
# Prérequis :
#   - Le DNS de assureursconseilservice.com pointe vers ce serveur
#   - Les ports 80 et 443 sont ouverts
#   - docker compose up -d déjà exécuté (nginx tourne avec cert auto-signé)
#
# Usage :
#   chmod +x scripts/init-ssl.sh
#   ./scripts/init-ssl.sh
# =============================================================================

set -e

DOMAIN="assureursconseilservice.com"
EMAIL="contact@assureursconseilservice.com"

echo "=============================================="
echo "  Initialisation SSL Let's Encrypt"
echo "  Domaine : ${DOMAIN}"
echo "=============================================="

# 1. Vérifier que nginx tourne (nécessaire pour le challenge ACME webroot)
echo ""
echo "[1/3] Vérification que nginx est en cours d'exécution..."
if ! docker compose ps nginx | grep -q "Up"; then
    echo "  -> nginx n'est pas démarré. Lancement..."
    docker compose up -d nginx
    echo "  -> Attente de 5 secondes..."
    sleep 5
fi
echo "  -> nginx OK"

# 2. Obtenir le certificat Let's Encrypt via certbot
echo ""
echo "[2/3] Obtention du certificat Let's Encrypt pour ${DOMAIN}..."
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d "${DOMAIN}" \
    -d "www.${DOMAIN}"

echo "  -> Certificat obtenu avec succès !"

# 3. Recharger nginx pour utiliser le vrai certificat
echo ""
echo "[3/3] Rechargement de nginx avec le vrai certificat..."
docker compose exec nginx nginx -s reload
echo "  -> nginx rechargé !"

echo ""
echo "=============================================="
echo "  SSL Let's Encrypt configuré avec succès !"
echo "  Certificat valable 90 jours."
echo ""
echo "  Renouvellement (à planifier dans cron) :"
echo "  docker compose run --rm certbot renew"
echo "  docker compose exec nginx nginx -s reload"
echo "=============================================="
