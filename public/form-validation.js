/**
 * Form Validation with Inline Error Messages
 * Provides real-time validation with user-friendly error messages
 */

class FormValidator {
    constructor() {
        this.validators = {
            required: (value) => value.trim() !== '',
            email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            minLength: (value, min) => value.length >= min,
            maxLength: (value, max) => value.length <= max,
            min: (value, min) => parseFloat(value) >= min,
            max: (value, max) => parseFloat(value) <= max,
            pattern: (value, pattern) => new RegExp(pattern).test(value),
            match: (value, matchValue) => value === matchValue,
            url: (value) => {
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            },
            number: (value) => !isNaN(parseFloat(value)) && isFinite(value),
            integer: (value) => Number.isInteger(parseFloat(value)),
            positive: (value) => parseFloat(value) > 0,
            date: (value) => !isNaN(Date.parse(value)),
            futureDate: (value) => new Date(value) > new Date(),
            pastDate: (value) => new Date(value) < new Date(),
            username: (value) => /^[a-zA-Z0-9_]{3,20}$/.test(value),
            password: (value) => value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value)
        };

        this.errorMessages = {
            required: 'This field is required',
            email: 'Please enter a valid email address',
            minLength: 'Must be at least {min} characters',
            maxLength: 'Must be no more than {max} characters',
            min: 'Must be at least {min}',
            max: 'Must be no more than {max}',
            pattern: 'Invalid format',
            match: 'Fields do not match',
            url: 'Please enter a valid URL',
            number: 'Please enter a valid number',
            integer: 'Please enter a whole number',
            positive: 'Must be a positive number',
            date: 'Please enter a valid date',
            futureDate: 'Date must be in the future',
            pastDate: 'Date must be in the past',
            username: 'Username must be 3-20 characters (letters, numbers, underscore only)',
            password: 'Password must be at least 8 characters with uppercase, lowercase, and number'
        };
    }

    /**
     * Initialize form validation
     */
    initForm(formId, options = {}) {
        const form = document.getElementById(formId);
        if (!form) {
            console.error(`Form with id "${formId}" not found`);
            return;
        }

        // Store validation rules
        form.validationRules = options.rules || {};
        form.validationMessages = options.messages || {};
        form.onValidSubmit = options.onSubmit;

        // Add real-time validation
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            // Validate on blur
            input.addEventListener('blur', () => {
                this.validateField(input, form.validationRules[input.name]);
            });

            // Clear error on input
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    this.clearFieldError(input);
                }
            });
        });

        // Handle form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit(form);
        });

        return form;
    }

    /**
     * Validate a single field
     */
    validateField(field, rules) {
        if (!rules) return true;

        const value = field.value;
        let isValid = true;
        let errorMessage = '';

        // Check each rule
        for (const [rule, ruleValue] of Object.entries(rules)) {
            if (rule === 'message') continue;

            const validator = this.validators[rule];
            if (!validator) {
                console.warn(`Unknown validation rule: ${rule}`);
                continue;
            }

            let valid;
            if (typeof ruleValue === 'boolean') {
                valid = ruleValue ? validator(value) : true;
            } else {
                valid = validator(value, ruleValue);
            }

            if (!valid) {
                isValid = false;
                errorMessage = rules.message || 
                    this.errorMessages[rule]?.replace('{' + rule + '}', ruleValue) ||
                    this.errorMessages[rule] ||
                    'Invalid input';
                break;
            }
        }

        if (isValid) {
            this.showFieldSuccess(field);
        } else {
            this.showFieldError(field, errorMessage);
        }

        return isValid;
    }

    /**
     * Show field error
     */
    showFieldError(field, message) {
        // Add error class
        field.classList.add('error');
        field.classList.remove('valid');

        // Remove existing error message
        this.clearFieldError(field, false);

        // Create error message element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message text-red-500 text-sm mt-1 animate-fade-in';
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle mr-1"></i>${message}`;
        errorDiv.dataset.errorFor = field.name;

        // Insert after field
        field.parentNode.insertBefore(errorDiv, field.nextSibling);

        // Add aria attributes for accessibility
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', `error-${field.name}`);
        errorDiv.id = `error-${field.name}`;
    }

    /**
     * Show field success
     */
    showFieldSuccess(field) {
        field.classList.remove('error');
        field.classList.add('valid');
        field.setAttribute('aria-invalid', 'false');
        this.clearFieldError(field);
    }

    /**
     * Clear field error
     */
    clearFieldError(field, removeClass = true) {
        if (removeClass) {
            field.classList.remove('error');
        }
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');

        // Remove error message
        const errorMsg = field.parentNode.querySelector(`[data-error-for="${field.name}"]`);
        if (errorMsg) {
            errorMsg.remove();
        }
    }

    /**
     * Validate entire form
     */
    validateForm(form) {
        const rules = form.validationRules || {};
        let isValid = true;
        let firstInvalidField = null;

        // Validate each field
        for (const [fieldName, fieldRules] of Object.entries(rules)) {
            const field = form.elements[fieldName];
            if (!field) continue;

            const fieldValid = this.validateField(field, fieldRules);
            if (!fieldValid && !firstInvalidField) {
                firstInvalidField = field;
            }
            isValid = isValid && fieldValid;
        }

        // Focus first invalid field
        if (!isValid && firstInvalidField) {
            firstInvalidField.focus();
            firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        return isValid;
    }

    /**
     * Handle form submission
     */
    async handleSubmit(form) {
        // Validate form
        const isValid = this.validateForm(form);
        if (!isValid) {
            if (typeof showNotification === 'function') {
                showNotification('Please fix the errors in the form', 'error');
            }
            return;
        }

        // Get form data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Show loading state
        const submitButton = form.querySelector('[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.classList.add('btn-loading');
        }

        try {
            // Call submit handler
            if (form.onValidSubmit) {
                await form.onValidSubmit(data, form);
            }
        } catch (error) {
            console.error('Form submission error:', error);
            if (typeof showNotification === 'function') {
                showNotification(error.message || 'Form submission failed', 'error');
            }
        } finally {
            // Remove loading state
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.classList.remove('btn-loading');
            }
        }
    }

    /**
     * Reset form validation
     */
    resetForm(form) {
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            this.clearFieldError(input);
            input.classList.remove('valid');
        });
        form.reset();
    }

    /**
     * Add custom validator
     */
    addValidator(name, validator, errorMessage) {
        this.validators[name] = validator;
        if (errorMessage) {
            this.errorMessages[name] = errorMessage;
        }
    }

    /**
     * Get form data
     */
    getFormData(form) {
        const formData = new FormData(form);
        return Object.fromEntries(formData.entries());
    }

    /**
     * Set form data
     */
    setFormData(form, data) {
        for (const [key, value] of Object.entries(data)) {
            const field = form.elements[key];
            if (field) {
                field.value = value;
            }
        }
    }
}

// Initialize global form validator
window.formValidator = new FormValidator();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormValidator;
}
