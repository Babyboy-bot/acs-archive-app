// __tests__/lib/validation.test.ts
import {
  isValidEmail,
  validateEmail,
  validateMinLength,
  validateMaxLength,
  validateRequired,
  validatePositiveNumber,
  validateNumberRange,
  sanitizeString,
  validateSafeString,
  validateFileType,
  validateFileSize,
  validateForm,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES
} from '../../lib/validation'

describe('Validation Utilities', () => {

  // ============================================================================
  // EMAIL VALIDATION
  // ============================================================================

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true)
      expect(isValidEmail('test123@example.io')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail('notanemail')).toBe(false)
      expect(isValidEmail('test@')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('test@.com')).toBe(false)
      expect(isValidEmail('test..test@example.com')).toBe(false)
    })

    it('should handle null/undefined values', () => {
      expect(isValidEmail(null as any)).toBe(false)
      expect(isValidEmail(undefined as any)).toBe(false)
    })

    it('should trim whitespace', () => {
      expect(isValidEmail('  test@example.com  ')).toBe(true)
    })
  })

  describe('validateEmail', () => {
    it('should validate and clean valid emails', () => {
      const result = validateEmail('Test.User@Example.COM')
      expect(result.isValid).toBe(true)
      expect(result.cleaned).toBe('test.user@example.com')
      expect(result.error).toBeUndefined()
    })

    it('should reject invalid emails with error messages', () => {
      const result = validateEmail('invalid-email')
      expect(result.isValid).toBe(false)
      expect(result.cleaned).toBeUndefined()
      expect(result.error).toBe('Format d\'email invalide')
    })

    it('should reject empty emails', () => {
      expect(validateEmail('').isValid).toBe(false)
      expect(validateEmail('   ').isValid).toBe(false)
      expect(validateEmail(null as any).isValid).toBe(false)
      expect(validateEmail(undefined as any).isValid).toBe(false)
    })
  })

  // ============================================================================
  // STRING VALIDATION
  // ============================================================================

  describe('validateRequired', () => {
    it('should accept non-empty strings', () => {
      expect(validateRequired('test').isValid).toBe(true)
      expect(validateRequired('  test  ').isValid).toBe(true)
    })

    it('should reject empty/null/undefined values', () => {
      expect(validateRequired('').isValid).toBe(false)
      expect(validateRequired('   ').isValid).toBe(false)
      expect(validateRequired(null).isValid).toBe(false)
      expect(validateRequired(undefined).isValid).toBe(false)
    })

    it('should provide custom field names in error messages', () => {
      const result = validateRequired('', 'Nom')
      expect(result.error).toBe('Nom est requis')
    })
  })

  describe('validateMinLength', () => {
    it('should accept strings meeting minimum length', () => {
      expect(validateMinLength('hello', 3).isValid).toBe(true)
      expect(validateMinLength('hi', 2).isValid).toBe(true)
    })

    it('should reject strings below minimum length', () => {
      const result = validateMinLength('hi', 5)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('doit contenir au moins 5 caractères')
    })

    it('should provide custom field names', () => {
      const result = validateMinLength('a', 3, 'Mot de passe')
      expect(result.error).toContain('Mot de passe')
    })
  })

  describe('validateMaxLength', () => {
    it('should accept strings under maximum length', () => {
      expect(validateMaxLength('hello', 10).isValid).toBe(true)
      expect(validateMaxLength('hi', 5).isValid).toBe(true)
    })

    it('should reject strings over maximum length', () => {
      const result = validateMaxLength('this is too long', 10)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('ne peut pas dépasser 10 caractères')
    })

    it('should accept empty strings', () => {
      expect(validateMaxLength('', 5).isValid).toBe(true)
    })
  })

  // ============================================================================
  // NUMBER VALIDATION
  // ============================================================================

  describe('validatePositiveNumber', () => {
    it('should accept positive numbers', () => {
      expect(validatePositiveNumber(5).isValid).toBe(true)
      expect(validatePositiveNumber(0.5).isValid).toBe(true)
      expect(validatePositiveNumber('10').isValid).toBe(true)
    })

    it('should reject zero and negative numbers', () => {
      expect(validatePositiveNumber(0).isValid).toBe(false)
      expect(validatePositiveNumber(-5).isValid).toBe(false)
      expect(validatePositiveNumber('-10').isValid).toBe(false)
    })

    it('should reject non-numeric values', () => {
      expect(validatePositiveNumber('abc').isValid).toBe(false)
      expect(validatePositiveNumber(NaN).isValid).toBe(false)
    })
  })

  describe('validateNumberRange', () => {
    it('should accept numbers within range', () => {
      expect(validateNumberRange(5, 1, 10).isValid).toBe(true)
      expect(validateNumberRange('7', 1, 10).isValid).toBe(true)
      expect(validateNumberRange(1, 1, 10).isValid).toBe(true)
      expect(validateNumberRange(10, 1, 10).isValid).toBe(true)
    })

    it('should reject numbers outside range', () => {
      expect(validateNumberRange(0, 1, 10).isValid).toBe(false)
      expect(validateNumberRange(15, 1, 10).isValid).toBe(false)
    })

    it('should reject non-numeric values', () => {
      const result = validateNumberRange('abc', 1, 10)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('doit être un nombre')
    })
  })

  // ============================================================================
  // SECURITY VALIDATION
  // ============================================================================

  describe('sanitizeString', () => {
    it('should remove dangerous HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")')
      expect(sanitizeString('<iframe src="evil.com">')).toBe('src="evil.com"')
    })

    it('should remove JavaScript URLs', () => {
      expect(sanitizeString('javascript:alert("xss")')).toBe('alert("xss")')
      expect(sanitizeString('JavaScript:evil()')).toBe('evil()')
    })

    it('should remove event handlers', () => {
      expect(sanitizeString('onclick=alert("xss")')).toBe('alert("xss")')
      expect(sanitizeString('onload="evil()"')).toBe('"evil()"')
    })

    it('should preserve safe content', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World')
      expect(sanitizeString('Test 123')).toBe('Test 123')
    })

    it('should trim whitespace', () => {
      expect(sanitizeString('  test  ')).toBe('test')
    })
  })

  describe('validateSafeString', () => {
    it('should accept safe strings', () => {
      const result = validateSafeString('Hello World')
      expect(result.isValid).toBe(true)
      expect(result.cleaned).toBe('Hello World')
    })

    it('should reject strings with script tags', () => {
      const result = validateSafeString('<script>evil()</script>')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('contient des caractères non autorisés')
    })

    it('should reject strings with script tags', () => {
      const result = validateSafeString('<script>evil()</script>')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('contient des caractères non autorisés')
    })

    it('should sanitize and return cleaned content for safe strings', () => {
      const result = validateSafeString('<b>Hello</b> safe content')
      expect(result.isValid).toBe(true)
      expect(result.cleaned).toBe('b>Hello/b> safe content')
    })

    it('should handle null/undefined', () => {
      expect(validateSafeString(null as any).isValid).toBe(true)
      expect(validateSafeString(undefined as any).isValid).toBe(true)
      expect(validateSafeString(null as any).cleaned).toBe('')
    })
  })

  // ============================================================================
  // FILE VALIDATION
  // ============================================================================

  describe('validateFileType', () => {
    const createMockFile = (type: string, name = 'test.jpg'): File => {
      return new File(['test'], name, { type })
    }

    it('should accept allowed image types', () => {
      const jpegFile = createMockFile('image/jpeg')
      const pngFile = createMockFile('image/png')
      const gifFile = createMockFile('image/gif')

      expect(validateFileType(jpegFile, ALLOWED_IMAGE_TYPES).isValid).toBe(true)
      expect(validateFileType(pngFile, ALLOWED_IMAGE_TYPES).isValid).toBe(true)
      expect(validateFileType(gifFile, ALLOWED_IMAGE_TYPES).isValid).toBe(true)
    })

    it('should accept allowed document types', () => {
      const pdfFile = createMockFile('application/pdf', 'test.pdf')
      const txtFile = createMockFile('text/plain', 'test.txt')

      expect(validateFileType(pdfFile, ALLOWED_DOCUMENT_TYPES).isValid).toBe(true)
      expect(validateFileType(txtFile, ALLOWED_DOCUMENT_TYPES).isValid).toBe(true)
    })

    it('should reject disallowed file types', () => {
      const exeFile = createMockFile('application/x-msdownload', 'test.exe')
      const result = validateFileType(exeFile, ALLOWED_IMAGE_TYPES)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('doit être de type')
    })

    it('should handle invalid files', () => {
      const invalidFile = { type: '', size: 0 } as any
      const result = validateFileType(invalidFile, ALLOWED_IMAGE_TYPES)

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Fichier invalide')
    })
  })

  describe('validateFileSize', () => {
    const createMockFile = (size: number): File => {
      const content = 'x'.repeat(size)
      return new File([content], 'test.txt', { type: 'text/plain' })
    }

    it('should accept files under size limit', () => {
      const smallFile = createMockFile(1000) // 1KB
      expect(validateFileSize(smallFile, 2000).isValid).toBe(true)
    })

    it('should reject files over size limit', () => {
      const largeFile = createMockFile(3000) // 3KB
      const result = validateFileSize(largeFile, 2000) // 2KB limit

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('ne peut pas dépasser')
      expect(result.error).toContain('2.0 KB')
    })

    it('should handle invalid files', () => {
      const invalidFile = { type: 'text/plain', size: null } as any
      const result = validateFileSize(invalidFile, 1000)

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Fichier invalide')
    })
  })

  // ============================================================================
  // FORM VALIDATION
  // ============================================================================

  describe('validateForm', () => {
    const formRules = {
      email: [(value: string) => validateEmail(value)],
      name: [
        (value: string) => validateRequired(value, 'Nom'),
        (value: string) => validateMinLength(value, 2, 'Nom')
      ],
      age: [(value: number) => validateNumberRange(value, 18, 100, 'Âge')]
    }

    it('should validate a complete valid form', () => {
      const formData = {
        email: 'test@example.com',
        name: 'John Doe',
        age: 25
      }

      const result = validateForm(formData, formRules)

      expect(result.isValid).toBe(true)
      expect(Object.keys(result.errors)).toHaveLength(0)
      expect(result.cleanedData).toEqual(formData)
    })

    it('should collect validation errors', () => {
      const formData = {
        email: 'invalid-email',
        name: '',
        age: 15
      }

      const result = validateForm(formData, formRules)

      expect(result.isValid).toBe(false)
      expect(Object.keys(result.errors)).toHaveLength(3)
      expect(result.errors.email).toContain('Format d\'email invalide')
      expect(result.errors.name).toContain('Nom est requis')
      expect(result.errors.age).toContain('doit être entre 18 et 100')
    })

    it('should stop at first error per field', () => {
      const formData = {
        name: '' // This will fail required check first
      }

      const result = validateForm(formData, formRules)

      expect(result.errors.name).toContain('requis') // Required error, not min length
    })

    it('should handle missing fields', () => {
      const formData = {} // No fields provided

      const result = validateForm(formData, formRules)

      expect(result.isValid).toBe(false)
      expect(Object.keys(result.errors)).toHaveLength(3)
    })
  })
})
