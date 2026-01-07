#!/usr/bin/env python
"""
Script pour ajouter les clients à l'application ACS Archive
"""
import os
import sys
import django

# Configuration Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'acs_backend.settings')
django.setup()

from api.models import Client

# Liste des clients à ajouter
clients_data = [
    # Assurances
    {"nom": "2ACI", "type": "ENTREPRISE"},
    {"nom": "ALLIANZ COTE D'IVOIRE", "type": "ENTREPRISE"},
    {"nom": "AMSA ASSURANCE", "type": "ENTREPRISE"},
    {"nom": "ASCOMA COTE D'IVOIRE", "type": "ENTREPRISE"},
    {"nom": "ATLANTA ASSURANCE", "type": "ENTREPRISE"},
    {"nom": "ATLANTIQUE ASSURANCE", "type": "ENTREPRISE"},
    {"nom": "ATLANTIQUE ASSURANCE VIE", "type": "ENTREPRISE"},
    {"nom": "ATLAS ASSURANCE", "type": "ENTREPRISE"},
    {"nom": "AXA COTE D'IVOIRE", "type": "ENTREPRISE"},
    {"nom": "COMAR ASSURANCE", "type": "ENTREPRISE"},
    {"nom": "GNA", "type": "ENTREPRISE"},
    {"nom": "L'AFRICAINE DES ASSURANCE", "type": "ENTREPRISE"},
    {"nom": "LA LOYALE VIE", "type": "ENTREPRISE"},
    {"nom": "MCI CARE", "type": "ENTREPRISE"},
    {"nom": "NSIA ASSURANCE", "type": "ENTREPRISE"},
    {"nom": "NSIA VIE", "type": "ENTREPRISE"},
    {"nom": "SAAR", "type": "ENTREPRISE"},
    {"nom": "SANLAM ASSURANCE", "type": "ENTREPRISE"},
    {"nom": "SANLAM VIE", "type": "ENTREPRISE"},
    {"nom": "SERENITY", "type": "ENTREPRISE"},
    {"nom": "SIDAM", "type": "ENTREPRISE"},
    {"nom": "SOMAVIE", "type": "ENTREPRISE"},
    {"nom": "SUNU ASSURANCE", "type": "ENTREPRISE"},
    {"nom": "SUNU VIE", "type": "ENTREPRISE"},
    {"nom": "VITALIS CI", "type": "ENTREPRISE"},
    {"nom": "YAKO AFRICA VIE", "type": "ENTREPRISE"},
    
    # Télécommunications et Technologie
    {"nom": "ATLANTIQUE TELECOM", "type": "ENTREPRISE"},
    {"nom": "BENE GROUPE SECURITE", "type": "ENTREPRISE"},
    {"nom": "BRAVO LABTECH SECURITY", "type": "ENTREPRISE"},
    {"nom": "CANAL+", "type": "ENTREPRISE"},
    {"nom": "CIE", "type": "ENTREPRISE"},
    {"nom": "CODITRANS", "type": "ENTREPRISE"},
    {"nom": "CORLAY", "type": "ENTREPRISE"},
    {"nom": "LA POSTE", "type": "ENTREPRISE"},
    {"nom": "MOOV", "type": "ENTREPRISE"},
    {"nom": "MTN CI", "type": "ENTREPRISE"},
    {"nom": "ORANGE CI", "type": "ENTREPRISE"},
    {"nom": "SECURITE PLUS SERVICE", "type": "ENTREPRISE"},
    {"nom": "SODECI", "type": "ENTREPRISE"},
    {"nom": "TOTAL ENERGY", "type": "ENTREPRISE"},
]

def add_clients():
    """Ajoute les clients à la base de données"""
    print("Ajout des clients à l'application ACS Archive...")
    
    added_count = 0
    skipped_count = 0
    
    for client_data in clients_data:
        client_name = client_data["nom"]
        
        # Vérifier si le client existe déjà
        if Client.objects.filter(nom=client_name).exists():
            print(f"⚠️  Client '{client_name}' existe déjà, ignoré")
            skipped_count += 1
            continue
        
        # Créer le client
        try:
            client = Client.objects.create(
                nom=client_name,
                type=client_data["type"]
            )
            print(f"✅ Client '{client_name}' ajouté avec succès (ID: {client.id})")
            added_count += 1
        except Exception as e:
            print(f"❌ Erreur lors de l'ajout du client '{client_name}': {e}")
    
    print(f"\n📊 Résumé:")
    print(f"   • Clients ajoutés: {added_count}")
    print(f"   • Clients ignorés: {skipped_count}")
    print(f"   • Total traités: {added_count + skipped_count}")

if __name__ == "__main__":
    add_clients()
