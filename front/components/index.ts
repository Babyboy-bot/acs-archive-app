/**
 * Exports centralisés des composants
 */

// Composants communs
export * from './common'

// Composants de layout
export * from './layout'

// Composants UI
export * from './ui/Alerte'
export * from './ui/Bouton'
export * from './ui/Carte'
export * from './ui/ChampTexte'
export * from './ui/ZoneTexte'

// Composants métier
export { Icon } from './Icon'
export type { IconName } from './Icon'
export { Navigation } from './Navigation'
export { Sidebar } from './Sidebar'
export { PreviewPDF } from './PreviewPDF'
export { SplashScreen } from './SplashScreen'
export { AvecSplashScreen } from './AvecSplashScreen'
export { RechercheGlobale } from './RechercheGlobale'
export { StatsTempsReel } from './StatsTempsReel'
export { ThemeInitializer } from './ThemeInitializer'

// Routes
export { PrivateRoute } from './PrivateRoute'
export { PublicRoute } from './PublicRoute'
