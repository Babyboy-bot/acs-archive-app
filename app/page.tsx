export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              ACS Archive
            </h1>
            <p className="text-xl text-gray-600">
              Application de Gestion d'Archives
            </p>
            <p className="text-sm text-gray-500 mt-2">
              ACS - Assureurs Conseils Service
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="mb-6">
              <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                Projet en Développement
              </h2>
              <p className="text-gray-600 mb-6">
                L'application est actuellement en phase de conception. <br />
                Consultez le cahier des charges pour plus de détails.
              </p>
            </div>

            {/* Features Preview */}
            <div className="grid md:grid-cols-3 gap-4 mt-8">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <div className="text-indigo-600 font-semibold mb-2">
                  📁 Gestion Documents
                </div>
                <p className="text-sm text-gray-600">
                  Upload et organisation de tous vos documents
                </p>
              </div>
              <div className="p-4 bg-indigo-50 rounded-lg">
                <div className="text-indigo-600 font-semibold mb-2">
                  🔍 Recherche Avancée
                </div>
                <p className="text-sm text-gray-600">
                  Retrouvez vos documents rapidement
                </p>
              </div>
              <div className="p-4 bg-indigo-50 rounded-lg">
                <div className="text-indigo-600 font-semibold mb-2">
                  🔒 Sécurisé
                </div>
                <p className="text-sm text-gray-600">
                  Données protégées et contrôle d'accès
                </p>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="text-sm text-gray-500">
            <p>Développé par : KASSI ELIE EMMANUEL & RODRIGUE</p>
            <p className="mt-1">Version 1.0 - Novembre 2025</p>
          </div>
        </div>
      </div>
    </div>
  );
}
