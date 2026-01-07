# Generated manually to add new clients

from django.db import migrations


def create_clients(apps, schema_editor):
    """Create new clients in the database"""
    Client = apps.get_model('api', 'Client')
    
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
    
    for client_data in clients_data:
        # Vérifier si le client existe déjà pour éviter les doublons
        if not Client.objects.filter(nom=client_data["nom"]).exists():
            Client.objects.create(
                nom=client_data["nom"],
                type=client_data["type"]
            )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_add_mot_de_passe_legacy'),
    ]

    operations = [
        migrations.RunPython(create_clients, migrations.RunPython.noop),
    ]
