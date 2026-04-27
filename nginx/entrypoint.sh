#!/bin/sh
# =============================================================================
# nginx entrypoint: génère un certificat auto-signé si les certs Let's Encrypt
# ne sont pas encore présents, puis démarre nginx normalement.
# =============================================================================

DOMAIN="assureursconseilservice.com"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
CERT_FILE="${CERT_DIR}/fullchain.pem"
KEY_FILE="${CERT_DIR}/privkey.pem"

if [ ! -f "${CERT_FILE}" ] || [ ! -f "${KEY_FILE}" ]; then
    echo "[nginx-init] Certificats Let's Encrypt absents pour ${DOMAIN}."
    echo "[nginx-init] Génération d'un certificat auto-signé temporaire..."

    mkdir -p "${CERT_DIR}"

    openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
        -keyout "${KEY_FILE}" \
        -out "${CERT_FILE}" \
        -subj "/CN=${DOMAIN}/O=ACS Archive/C=FR" \
        -addext "subjectAltName=DNS:${DOMAIN},DNS:localhost,IP:127.0.0.1,IP:192.168.1.50" 2>/dev/null

    echo "[nginx-init] Certificat auto-signé généré (valable 365 jours)."
    echo "[nginx-init] Exécutez 'docker compose run --rm certbot' pour obtenir le vrai certificat."
else
    echo "[nginx-init] Certificats Let's Encrypt trouvés pour ${DOMAIN}."
fi

echo "[nginx-init] Démarrage de nginx..."
exec nginx -g "daemon off;"
