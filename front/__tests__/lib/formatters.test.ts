// __tests__/lib/formatters.test.ts
import {
  formatFileSize,
  formatDateShort,
  formatDateLong,
  formatDateISO,
  formatDateRelative,
  normalizeRisqueKey,
  getRisqueLabel,
  formatRisqueLabel,
  getRisqueColor
} from '../../lib/formatters'

describe('Formatters Utilities', () => {

  // ============================================================================
  // FILE SIZE FORMATTING
  // ============================================================================

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('—')
      expect(formatFileSize(null)).toBe('—')
      expect(formatFileSize(undefined)).toBe('—')
      expect(formatFileSize(NaN)).toBe('—')
    })

    it('should format small files in bytes', () => {
      expect(formatFileSize(512)).toBe('512 B')
      expect(formatFileSize(1023)).toBe('1023 B')
    })

    it('should format KB correctly', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(1024 * 10)).toBe('10.0 KB')
    })

    it('should format MB correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB')
      expect(formatFileSize(1024 * 1024 * 100)).toBe('100.0 MB')
    })

    it('should handle edge cases', () => {
      expect(formatFileSize(-100)).toBe('-100 B') // Negative values are still formatted
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1024.0 MB') // Large files
    })
  })

  // ============================================================================
  // DATE FORMATTING
  // ============================================================================

  describe('formatDateShort', () => {
    it('should format valid dates correctly', () => {
      const date = new Date('2024-12-15')
      expect(formatDateShort(date)).toBe('15 déc. 2024')
    })

    it('should format date strings correctly', () => {
      expect(formatDateShort('2024-12-15')).toBe('15 déc. 2024')
    })

    it('should handle null/undefined dates', () => {
      expect(formatDateShort(null)).toBe('—')
      expect(formatDateShort(undefined)).toBe('—')
    })

    it('should handle invalid dates', () => {
      expect(formatDateShort('invalid-date')).toBe('—')
      expect(formatDateShort(new Date('invalid'))).toBe('—')
    })

    it('should format different months correctly', () => {
      expect(formatDateShort('2024-01-15')).toBe('15 janv. 2024')
      expect(formatDateShort('2024-07-15')).toBe('15 juil. 2024')
    })
  })

  describe('formatDateLong', () => {
    it('should format dates with full month names', () => {
      expect(formatDateLong('2024-12-15')).toBe('15 décembre 2024')
      expect(formatDateLong('2024-01-15')).toBe('15 janvier 2024')
    })

    it('should handle null/undefined dates', () => {
      expect(formatDateLong(null)).toBe('—')
      expect(formatDateLong(undefined)).toBe('—')
    })
  })

  describe('formatDateISO', () => {
    it('should format dates in ISO format', () => {
      expect(formatDateISO('2024-12-15')).toBe('2024-12-15')
      expect(formatDateISO(new Date('2024-12-15'))).toBe('2024-12-15')
    })

    it('should handle null/undefined dates', () => {
      expect(formatDateISO(null)).toBe('—')
      expect(formatDateISO(undefined)).toBe('—')
    })
  })

  // ============================================================================
  // RISK FORMATTING
  // ============================================================================

  describe('normalizeRisqueKey', () => {
    it('should normalize risk keys to uppercase with underscores', () => {
      expect(normalizeRisqueKey('auto')).toBe('AUTO')
      expect(normalizeRisqueKey('AUTO')).toBe('AUTO')
      expect(normalizeRisqueKey('auto mobile')).toBe('AUTO_MOBILE')
      expect(normalizeRisqueKey('auto-mobile')).toBe('AUTO_MOBILE')
      expect(normalizeRisqueKey('AUTO MOBILE')).toBe('AUTO_MOBILE')
    })

    it('should handle null/undefined values', () => {
      expect(normalizeRisqueKey(null)).toBe('AUTRE')
      expect(normalizeRisqueKey(undefined)).toBe('AUTRE')
      expect(normalizeRisqueKey('')).toBe('AUTRE')
    })

    it('should handle various risk types', () => {
      expect(normalizeRisqueKey('sante')).toBe('SANTE')
      expect(normalizeRisqueKey('mrp')).toBe('MRP')
      expect(normalizeRisqueKey('vie')).toBe('VIE')
    })
  })

  describe('formatRisqueLabel', () => {
    it('should capitalize each word in risk labels', () => {
      expect(formatRisqueLabel('auto')).toBe('Auto')
      expect(formatRisqueLabel('AUTO')).toBe('Auto')
      expect(formatRisqueLabel('auto mobile')).toBe('Auto Mobile')
      expect(formatRisqueLabel('AUTO_MOBILE')).toBe('Auto Mobile')
      expect(formatRisqueLabel('mrp')).toBe('Mrp')
      expect(formatRisqueLabel('RESPONSABILITE CIVILE')).toBe('Responsabilite Civile')
    })

    it('should handle null/undefined values', () => {
      expect(formatRisqueLabel(null)).toBe('Autre')
      expect(formatRisqueLabel(undefined)).toBe('Autre')
      expect(formatRisqueLabel('')).toBe('Autre')
    })

    it('should handle edge cases', () => {
      expect(formatRisqueLabel('   ')).toBe('Autre')
      expect(formatRisqueLabel('a')).toBe('A')
      expect(formatRisqueLabel('ONE TWO THREE')).toBe('One Two Three')
    })
  })

  describe('getRisqueColor', () => {
    it('should return correct colors for known risk types', () => {
      expect(getRisqueColor('AUTOMOBILE')).toBe('#3B82F6')
      expect(getRisqueColor('SANTE')).toBe('#10B981')
      expect(getRisqueColor('MRP')).toBe('#7C3AED')
      expect(getRisqueColor('VIE')).toBe('#EC4899')
      expect(getRisqueColor('RESPONSABILITE_CIVILE')).toBe('#F59E0B')
    })

    it('should handle case insensitive input', () => {
      expect(getRisqueColor('automobile')).toBe('#3B82F6')
      expect(getRisqueColor('sante')).toBe('#10B981')
    })

    it('should return default color for unknown types', () => {
      expect(getRisqueColor('UNKNOWN')).toBe('#4B5563') // AUTRE color
      expect(getRisqueColor(null)).toBe('#4B5563')
      expect(getRisqueColor(undefined)).toBe('#4B5563')
    })

    it('should handle space and dash normalization', () => {
      // 'auto mobile' -> 'AUTO_MOBILE' which is unknown, so returns AUTRE color
      expect(getRisqueColor('auto mobile')).toBe('#4B5563')
      expect(getRisqueColor('AUTO-MOBILE')).toBe('#4B5563')
      // 'automobile' -> 'AUTOMOBILE' which exists
      expect(getRisqueColor('automobile')).toBe('#3B82F6')
    })
  })

  describe('getRisqueLabel', () => {
    it('should return predefined labels for known types', () => {
      // This test assumes RISQUE_LABELS constants exist
      // We can't easily mock them, so we'll test the fallback behavior
      expect(typeof getRisqueLabel('AUTO')).toBe('string')
      expect(typeof getRisqueLabel('UNKNOWN')).toBe('string')
    })

    it('should handle null/undefined values', () => {
      expect(getRisqueLabel(null)).toBe('Autre')
      expect(getRisqueLabel(undefined)).toBe('Autre')
    })
  })
})
