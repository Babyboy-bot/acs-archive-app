import {
  DocumentIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  ArrowUpTrayIcon,
  UserIcon,
  UsersIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  BellIcon,
  HomeIcon,
  PlusIcon,
  XMarkIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  TagIcon,
  ClockIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  TruckIcon,
  HeartIcon,
  ShieldCheckIcon,
  InboxIcon,
  PaperAirplaneIcon,
  EnvelopeIcon,
  LockClosedIcon,
  KeyIcon,
  PhoneIcon,
  AtSymbolIcon,
  SunIcon,
  MoonIcon,
  LanguageIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  SparklesIcon,
  FireIcon,
  BoltIcon,
  StarIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline'

import {
  DocumentIcon as DocumentSolidIcon,
  FolderIcon as FolderSolidIcon,
  UserIcon as UserSolidIcon,
  CheckCircleIcon as CheckCircleSolidIcon,
} from '@heroicons/react/24/solid'

export type IconName = 
  | 'document' | 'folder' | 'search' | 'upload' | 'user' | 'users' | 'settings'
  | 'chart' | 'bell' | 'home' | 'plus' | 'close' | 'eye' | 'download' | 'trash'
  | 'edit' | 'check' | 'tag' | 'clock' | 'calendar' | 'building' | 'truck'
  | 'heart' | 'shield' | 'inbox' | 'send' | 'email' | 'lock' | 'key'
  | 'phone' | 'at' | 'sun' | 'moon' | 'language' | 'arrow-right' | 'arrow-left'
  | 'chevron-right' | 'check-circle' | 'warning' | 'info' | 'sparkles'
  | 'fire' | 'bolt' | 'star' | 'card'
  | 'document-solid' | 'folder-solid' | 'user-solid' | 'check-circle-solid'

interface IconProps {
  name: IconName
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  gradient?: boolean
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
}

const icons = {
  document: DocumentIcon,
  folder: FolderIcon,
  search: MagnifyingGlassIcon,
  upload: ArrowUpTrayIcon,
  user: UserIcon,
  users: UsersIcon,
  settings: Cog6ToothIcon,
  chart: ChartBarIcon,
  bell: BellIcon,
  home: HomeIcon,
  plus: PlusIcon,
  close: XMarkIcon,
  eye: EyeIcon,
  download: ArrowDownTrayIcon,
  trash: TrashIcon,
  edit: PencilIcon,
  check: CheckIcon,
  tag: TagIcon,
  clock: ClockIcon,
  calendar: CalendarIcon,
  building: BuildingOfficeIcon,
  truck: TruckIcon,
  heart: HeartIcon,
  shield: ShieldCheckIcon,
  inbox: InboxIcon,
  send: PaperAirplaneIcon,
  email: EnvelopeIcon,
  lock: LockClosedIcon,
  key: KeyIcon,
  phone: PhoneIcon,
  at: AtSymbolIcon,
  sun: SunIcon,
  moon: MoonIcon,
  language: LanguageIcon,
  'arrow-right': ArrowRightIcon,
  'arrow-left': ArrowLeftIcon,
  'chevron-right': ChevronRightIcon,
  'check-circle': CheckCircleIcon,
  warning: ExclamationCircleIcon,
  info: InformationCircleIcon,
  sparkles: SparklesIcon,
  fire: FireIcon,
  bolt: BoltIcon,
  star: StarIcon,
  card: CreditCardIcon,
  'document-solid': DocumentSolidIcon,
  'folder-solid': FolderSolidIcon,
  'user-solid': UserSolidIcon,
  'check-circle-solid': CheckCircleSolidIcon,
}

export function Icon({ name, className = '', size = 'md', gradient = false }: IconProps) {
  const IconComponent = icons[name]
  const sizeClass = sizeClasses[size]
  
  if (gradient) {
    return (
      <svg className={`${sizeClass} ${className}`} viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id={`gradient-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D32027" />
            <stop offset="100%" stopColor="#0066B3" />
          </linearGradient>
        </defs>
        <IconComponent className="w-full h-full" style={{ stroke: `url(#gradient-${name})` }} />
      </svg>
    )
  }
  
  return <IconComponent className={`${sizeClass} ${className}`} />
}
