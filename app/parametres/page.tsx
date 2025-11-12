'use client'

import { useState } from 'react'
import { Navigation } from '@/components/Navigation'
import { Bouton } from '@/components/ui/Bouton'
import { ChampTexte } from '@/components/ui/ChampTexte'
import { Alerte } from '@/components/ui/Alerte'

export default function PageParametres() {
  // Informations personnelles
  const [nom, setNom] = useState('Kassi')
  const [prenom, setPrenom] = useState('Elie Emmanuel')
  const [email, setEmail] = useState('elie.kassi@acs.ci')
  const [telephone, setTelephone] = useState('+225 07 00 00 00 00')

  // Mot de passe
  const [ancienMdp, setAncienMdp] = useState('')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmMdp, setConfirmMdp] = useState('')

  // Notifications
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [nouveauxDocs, setNouveauxDocs] = useState(true)
  const [modifications, setModifications] = useState(true)
  const [rapports, setRapports] = useState(false)

  // États
  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState('')
  const [erreur, setErreur] = useState('')

  const gererSauvegardeProfil = (e: React.FormEvent) => {
    e.preventDefault()
    setChargement(true)
    setSucces('')
    setErreur('')

    // TODO: Implémenter la sauvegarde
    setTimeout(() => {
      setChargement(false)
      setSucces('Profil mis à jour avec succès !')
      setTimeout(() => setSucces(''), 3000)
    }, 1000)
  }

  const gererChangementMdp = (e: React.FormEvent) => {
    e.preventDefault()
    setErreur('')
    setSucces('')

    if (nouveauMdp !== confirmMdp) {
      setErreur('Les mots de passe ne correspondent pas')
      return
    }

    if (nouveauMdp.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    setChargement(true)

    // TODO: Implémenter le changement
    setTimeout(() => {
      setChargement(false)
      setSucces('Mot de passe modifié avec succès !')
      setAncienMdp('')
      setNouveauMdp('')
      setConfirmMdp('')
      setTimeout(() => setSucces(''), 3000)
    }, 1000)
  }

  const gererSauvegardeNotifs = () => {
    setChargement(true)
    setSucces('')

    // TODO: Implémenter la sauvegarde
    setTimeout(() => {
      setChargement(false)
      setSucces('Préférences de notification enregistrées !')
      setTimeout(() => setSucces(''), 3000)
    }, 1000)
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#1F2937' }}>Paramètres</h1>
          <p style={{ color: '#6B7280' }}>Gérez votre profil et vos préférences</p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Alertes */}
          {succes && (
            <Alerte type="succes" message={succes} surFermeture={() => setSucces('')} />
          )}
          {erreur && (
            <Alerte type="erreur" message={erreur} surFermeture={() => setErreur('')} />
          )}

          {/* Informations personnelles */}
          <div className="bg-white rounded-xl shadow-md p-8">
            <div className="flex items-center gap-4 mb-6">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                style={{ background: 'linear-gradient(135deg, #D32027 0%, #0066B3 100%)' }}
              >
                {prenom[0]}{nom[0]}
              </div>
              <div>
                <h2 className="text-2xl font-bold" style={{ color: '#1F2937' }}>
                  {prenom} {nom}
                </h2>
                <p className="text-gray-600">{email}</p>
              </div>
            </div>

            <form onSubmit={gererSauvegardeProfil} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <ChampTexte
                  etiquette="Nom"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  obligatoire
                />
                <ChampTexte
                  etiquette="Prénom"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  obligatoire
                />
              </div>

              <ChampTexte
                etiquette="Adresse email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                obligatoire
              />

              <ChampTexte
                etiquette="Téléphone"
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
              />

              <Bouton 
                type="submit" 
                variante="primaire"
                chargement={chargement}
              >
                Enregistrer les modifications
              </Bouton>
            </form>
          </div>

          {/* Sécurité */}
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-xl font-bold mb-6" style={{ color: '#1F2937' }}>
              🔒 Sécurité
            </h2>

            <form onSubmit={gererChangementMdp} className="space-y-6">
              <ChampTexte
                etiquette="Mot de passe actuel"
                type="password"
                value={ancienMdp}
                onChange={(e) => setAncienMdp(e.target.value)}
                obligatoire
              />

              <div className="grid md:grid-cols-2 gap-6">
                <ChampTexte
                  etiquette="Nouveau mot de passe"
                  type="password"
                  value={nouveauMdp}
                  onChange={(e) => setNouveauMdp(e.target.value)}
                  obligatoire
                />
                <ChampTexte
                  etiquette="Confirmer le mot de passe"
                  type="password"
                  value={confirmMdp}
                  onChange={(e) => setConfirmMdp(e.target.value)}
                  obligatoire
                />
              </div>

              <p className="text-sm text-gray-500">
                Le mot de passe doit contenir au moins 8 caractères, incluant majuscules, minuscules et chiffres.
              </p>

              <Bouton 
                type="submit" 
                variante="primaire"
                chargement={chargement}
              >
                Changer le mot de passe
              </Bouton>
            </form>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-xl font-bold mb-6" style={{ color: '#1F2937' }}>
              🔔 Notifications
            </h2>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <div>
                  <p className="font-medium" style={{ color: '#1F2937' }}>Notifications par email</p>
                  <p className="text-sm text-gray-600">Recevoir des alertes par email</p>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotifs}
                  onChange={(e) => setEmailNotifs(e.target.checked)}
                  className="w-5 h-5 rounded"
                  style={{ accentColor: '#D32027' }}
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <div>
                  <p className="font-medium" style={{ color: '#1F2937' }}>Nouveaux documents</p>
                  <p className="text-sm text-gray-600">Être notifié lors de l'ajout de documents</p>
                </div>
                <input
                  type="checkbox"
                  checked={nouveauxDocs}
                  onChange={(e) => setNouveauxDocs(e.target.checked)}
                  className="w-5 h-5 rounded"
                  style={{ accentColor: '#0066B3' }}
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <div>
                  <p className="font-medium" style={{ color: '#1F2937' }}>Modifications</p>
                  <p className="text-sm text-gray-600">Suivre les modifications de documents</p>
                </div>
                <input
                  type="checkbox"
                  checked={modifications}
                  onChange={(e) => setModifications(e.target.checked)}
                  className="w-5 h-5 rounded"
                  style={{ accentColor: '#D32027' }}
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <div>
                  <p className="font-medium" style={{ color: '#1F2937' }}>Rapports hebdomadaires</p>
                  <p className="text-sm text-gray-600">Recevoir un résumé chaque semaine</p>
                </div>
                <input
                  type="checkbox"
                  checked={rapports}
                  onChange={(e) => setRapports(e.target.checked)}
                  className="w-5 h-5 rounded"
                  style={{ accentColor: '#0066B3' }}
                />
              </label>
            </div>

            <div className="mt-6">
              <Bouton 
                onClick={gererSauvegardeNotifs}
                variante="primaire"
                chargement={chargement}
              >
                Enregistrer les préférences
              </Bouton>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-xl shadow-md p-8 border-2" style={{ borderColor: '#FEE2E2' }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: '#DC2626' }}>
              ⚠️ Zone dangereuse
            </h2>
            <p className="text-gray-600 mb-4">
              Une fois votre compte supprimé, vous perdrez l'accès à tous vos documents et données.
            </p>
            <Bouton 
              variante="secondaire"
              onClick={() => {
                if (confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')) {
                  alert('Fonctionnalité en développement')
                }
              }}
              style={{ 
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                border: '2px solid #DC2626'
              }}
            >
              Supprimer mon compte
            </Bouton>
          </div>
        </div>
      </main>
    </div>
  )
}
