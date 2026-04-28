/**
 * Accessibility Testing Script
 * Tests WCAG 2.1 AA compliance for the Sealed Auction Platform
 */

const fs = require('fs');
const path = require('path');

class AccessibilityTester {
    constructor() {
        this.results = {
            passed: [],
            failed: [],
            warnings: []
        };
    }

    /**
     * Run all accessibility tests
     */
    async runTests() {
        console.log('🔍 Starting Accessibility Tests...\n');

        this.testHTMLStructure();
        this.testARIAAttributes();
        this.testFormAccessibility();
        this.testKeyboardNavigation();
        this.testColorContrast();
        this.testImageAltText();
        this.testHeadingHierarchy();
        this.testLinkAccessibility();
        this.testTableAccessibility();

        this.printResults();
    }

    /**
     * Test HTML structure and semantic elements
     */
    testHTMLStructure() {
        console.log('Testing HTML Structure...');
        
        const htmlFiles = this.getHTMLFiles();
        
        htmlFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            
            // Check for lang attribute
            if (content.includes('<html') && !content.includes('lang=')) {
                this.fail(`${file}: Missing lang attribute on <html> element`);
            } else {
                this.pass(`${file}: Has lang attribute`);
            }

            // Check for main landmark
            if (!content.includes('<main') && !content.includes('role="main"')) {
                this.fail(`${file}: Missing <main> landmark`);
            } else {
                this.pass(`${file}: Has main landmark`);
            }

            // Check for header
            if (!content.includes('<header') && !content.includes('role="banner"')) {
                this.warn(`${file}: Missing <header> landmark`);
            } else {
                this.pass(`${file}: Has header landmark`);
            }

            // Check for nav
            if (!content.includes('<nav') && !content.includes('role="navigation"')) {
                this.warn(`${file}: Missing <nav> landmark`);
            } else {
                this.pass(`${file}: Has navigation landmark`);
            }

            // Check for skip link
            if (!content.includes('skip') && !content.includes('Skip to')) {
                this.warn(`${file}: Missing skip navigation link`);
            } else {
                this.pass(`${file}: Has skip navigation link`);
            }
        });
    }

    /**
     * Test ARIA attributes
     */
    testARIAAttributes() {
        console.log('\nTesting ARIA Attributes...');
        
        const htmlFiles = this.getHTMLFiles();
        
        htmlFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            
            // Check for ARIA labels on buttons without text
            const iconOnlyButtons = content.match(/<button[^>]*>[\s]*<i[^>]*>[\s]*<\/i>[\s]*<\/button>/g);
            if (iconOnlyButtons) {
                iconOnlyButtons.forEach(btn => {
                    if (!btn.includes('aria-label') && !btn.includes('title')) {
                        this.fail(`${file}: Icon-only button missing aria-label`);
                    }
                });
            }

            // Check for ARIA live regions
            if (!content.includes('aria-live')) {
                this.warn(`${file}: No ARIA live regions found`);
            } else {
                this.pass(`${file}: Has ARIA live regions`);
            }

            // Check for modal dialogs
            const modals = content.match(/class="[^"]*modal[^"]*"/g);
            if (modals) {
                if (!content.includes('role="dialog"')) {
                    this.fail(`${file}: Modal missing role="dialog"`);
                } else {
                    this.pass(`${file}: Modal has proper role`);
                }

                if (!content.includes('aria-modal')) {
                    this.fail(`${file}: Modal missing aria-modal attribute`);
                } else {
                    this.pass(`${file}: Modal has aria-modal attribute`);
                }
            }

            // Check for tab navigation
            if (content.includes('tab') || content.includes('Tab')) {
                if (!content.includes('role="tablist"')) {
                    this.warn(`${file}: Tabs missing role="tablist"`);
                } else {
                    this.pass(`${file}: Tabs have proper ARIA roles`);
                }
            }
        });
    }

    /**
     * Test form accessibility
     */
    testFormAccessibility() {
        console.log('\nTesting Form Accessibility...');
        
        const htmlFiles = this.getHTMLFiles();
        
        htmlFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            
            // Check for form labels
            const inputs = content.match(/<input[^>]*>/g) || [];
            inputs.forEach(input => {
                const hasId = input.includes('id=');
                const hasAriaLabel = input.includes('aria-label');
                const hasAriaLabelledby = input.includes('aria-labelledby');
                
                if (!hasAriaLabel && !hasAriaLabelledby) {
                    if (hasId) {
                        const id = input.match(/id="([^"]*)"/)?.[1];
                        if (id && !content.includes(`for="${id}"`)) {
                            this.fail(`${file}: Input with id="${id}" missing associated label`);
                        }
                    } else {
                        this.fail(`${file}: Input missing label or ARIA label`);
                    }
                }
            });

            // Check for required field indicators
            const requiredInputs = content.match(/<input[^>]*required[^>]*>/g) || [];
            requiredInputs.forEach(input => {
                if (!input.includes('aria-required')) {
                    this.warn(`${file}: Required input missing aria-required attribute`);
                }
            });

            // Check for error messages
            if (content.includes('error') || content.includes('Error')) {
                if (!content.includes('aria-describedby') && !content.includes('role="alert"')) {
                    this.warn(`${file}: Error messages may not be properly associated with inputs`);
                }
            }

            // Check for autocomplete attributes
            if (content.includes('type="email"') || content.includes('type="password"')) {
                if (!content.includes('autocomplete=')) {
                    this.warn(`${file}: Form inputs missing autocomplete attributes`);
                }
            }
        });
    }

    /**
     * Test keyboard navigation
     */
    testKeyboardNavigation() {
        console.log('\nTesting Keyboard Navigation...');
        
        const htmlFiles = this.getHTMLFiles();
        
        htmlFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            
            // Check for onclick on non-interactive elements
            const divOnClick = content.match(/<div[^>]*onclick[^>]*>/g);
            if (divOnClick) {
                divOnClick.forEach(div => {
                    if (!div.includes('tabindex') && !div.includes('role="button"')) {
                        this.fail(`${file}: Clickable div missing tabindex and role`);
                    }
                });
            }

            // Check for focus indicators
            if (!content.includes(':focus') && !content.includes('focus-visible')) {
                this.warn(`${file}: No focus styles defined`);
            } else {
                this.pass(`${file}: Has focus styles`);
            }

            // Check for tabindex usage
            const negativeTabindex = content.match(/tabindex="-1"/g);
            if (negativeTabindex && negativeTabindex.length > 5) {
                this.warn(`${file}: Many elements with tabindex="-1", verify intentional`);
            }
        });
    }

    /**
     * Test color contrast
     */
    testColorContrast() {
        console.log('\nTesting Color Contrast...');
        
        const cssFiles = this.getCSSFiles();
        
        cssFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            
            // Check for color definitions
            if (content.includes('color:') || content.includes('background')) {
                this.pass(`${file}: Contains color definitions (manual review needed)`);
            }

            // Check for contrast variables
            if (content.includes('--text-') && content.includes('--bg-')) {
                this.pass(`${file}: Uses CSS variables for colors`);
            }
        });

        this.warn('Color contrast requires manual testing with tools like:');
        this.warn('- Chrome DevTools Lighthouse');
        this.warn('- WebAIM Contrast Checker');
        this.warn('- axe DevTools');
    }

    /**
     * Test image alt text
     */
    testImageAltText() {
        console.log('\nTesting Image Alt Text...');
        
        const htmlFiles = this.getHTMLFiles();
        
        htmlFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            
            // Check for images without alt
            const images = content.match(/<img[^>]*>/g) || [];
            images.forEach(img => {
                if (!img.includes('alt=')) {
                    this.fail(`${file}: Image missing alt attribute`);
                } else if (img.includes('alt=""') && !img.includes('aria-hidden')) {
                    this.warn(`${file}: Image has empty alt, verify if decorative`);
                } else {
                    this.pass(`${file}: Image has alt attribute`);
                }
            });

            // Check for background images
            if (content.includes('background-image:') || content.includes('background:')) {
                this.warn(`${file}: Contains background images, ensure decorative only`);
            }

            // Check for icon fonts
            const iconFonts = content.match(/<i[^>]*class="[^"]*fa[^"]*"[^>]*>/g) || [];
            iconFonts.forEach(icon => {
                const parent = content.substring(
                    Math.max(0, content.indexOf(icon) - 100),
                    content.indexOf(icon) + icon.length + 100
                );
                
                if (!parent.includes('aria-hidden') && !parent.includes('aria-label')) {
                    this.warn(`${file}: Icon font may need aria-hidden or aria-label`);
                }
            });
        });
    }

    /**
     * Test heading hierarchy
     */
    testHeadingHierarchy() {
        console.log('\nTesting Heading Hierarchy...');
        
        const htmlFiles = this.getHTMLFiles();
        
        htmlFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            
            // Extract headings
            const headings = [];
            for (let i = 1; i <= 6; i++) {
                const regex = new RegExp(`<h${i}[^>]*>`, 'g');
                const matches = content.match(regex) || [];
                matches.forEach(() => headings.push(i));
            }

            if (headings.length === 0) {
                this.warn(`${file}: No headings found`);
                return;
            }

            // Check for h1
            if (!headings.includes(1)) {
                this.fail(`${file}: Missing h1 heading`);
            } else {
                this.pass(`${file}: Has h1 heading`);
            }

            // Check for skipped levels
            for (let i = 1; i < headings.length; i++) {
                if (headings[i] - headings[i - 1] > 1) {
                    this.warn(`${file}: Heading hierarchy may skip levels`);
                    break;
                }
            }
        });
    }

    /**
     * Test link accessibility
     */
    testLinkAccessibility() {
        console.log('\nTesting Link Accessibility...');
        
        const htmlFiles = this.getHTMLFiles();
        
        htmlFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            
            // Check for empty links
            const emptyLinks = content.match(/<a[^>]*>[\s]*<\/a>/g);
            if (emptyLinks) {
                this.fail(`${file}: Empty links found`);
            }

            // Check for "click here" or "read more"
            if (content.includes('>Click here<') || content.includes('>Read more<')) {
                this.warn(`${file}: Generic link text found (click here, read more)`);
            }

            // Check for links opening in new window
            const newWindowLinks = content.match(/<a[^>]*target="_blank"[^>]*>/g) || [];
            newWindowLinks.forEach(link => {
                if (!link.includes('aria-label') && !link.includes('title')) {
                    this.warn(`${file}: Link opening in new window should indicate this`);
                }
            });
        });
    }

    /**
     * Test table accessibility
     */
    testTableAccessibility() {
        console.log('\nTesting Table Accessibility...');
        
        const htmlFiles = this.getHTMLFiles();
        
        htmlFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            
            // Check for tables
            const tables = content.match(/<table[^>]*>/g) || [];
            if (tables.length === 0) return;

            // Check for table headers
            if (!content.includes('<th')) {
                this.fail(`${file}: Table missing header cells (<th>)`);
            } else {
                this.pass(`${file}: Table has header cells`);
            }

            // Check for scope attribute
            if (!content.includes('scope=')) {
                this.warn(`${file}: Table headers missing scope attribute`);
            }

            // Check for caption
            if (!content.includes('<caption')) {
                this.warn(`${file}: Table missing caption`);
            }

            // Check for complex tables
            if (content.includes('colspan') || content.includes('rowspan')) {
                this.warn(`${file}: Complex table found, verify proper headers association`);
            }
        });
    }

    /**
     * Get all HTML files
     */
    getHTMLFiles() {
        const publicDir = path.join(__dirname, 'public');
        const files = fs.readdirSync(publicDir);
        return files
            .filter(file => file.endsWith('.html'))
            .map(file => path.join(publicDir, file));
    }

    /**
     * Get all CSS files
     */
    getCSSFiles() {
        const publicDir = path.join(__dirname, 'public');
        const files = fs.readdirSync(publicDir);
        return files
            .filter(file => file.endsWith('.css'))
            .map(file => path.join(publicDir, file));
    }

    /**
     * Record passed test
     */
    pass(message) {
        this.results.passed.push(message);
    }

    /**
     * Record failed test
     */
    fail(message) {
        this.results.failed.push(message);
    }

    /**
     * Record warning
     */
    warn(message) {
        this.results.warnings.push(message);
    }

    /**
     * Print test results
     */
    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('ACCESSIBILITY TEST RESULTS');
        console.log('='.repeat(60));

        console.log(`\n✅ Passed: ${this.results.passed.length}`);
        console.log(`❌ Failed: ${this.results.failed.length}`);
        console.log(`⚠️  Warnings: ${this.results.warnings.length}`);

        if (this.results.failed.length > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.results.failed.forEach(msg => console.log(`  - ${msg}`));
        }

        if (this.results.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            this.results.warnings.forEach(msg => console.log(`  - ${msg}`));
        }

        console.log('\n' + '='.repeat(60));
        
        const score = Math.round(
            (this.results.passed.length / 
            (this.results.passed.length + this.results.failed.length)) * 100
        );
        
        console.log(`\nAccessibility Score: ${score}%`);
        
        if (score >= 90) {
            console.log('🎉 Excellent! Your site is highly accessible.');
        } else if (score >= 70) {
            console.log('👍 Good progress, but some improvements needed.');
        } else {
            console.log('⚠️  Significant accessibility improvements required.');
        }

        console.log('\n📚 Next Steps:');
        console.log('  1. Fix all failed tests');
        console.log('  2. Review and address warnings');
        console.log('  3. Test with real screen readers (NVDA, JAWS, VoiceOver)');
        console.log('  4. Test keyboard navigation manually');
        console.log('  5. Run automated tools (axe, Lighthouse, WAVE)');
        console.log('  6. Test with users who rely on assistive technologies');
        
        console.log('\n' + '='.repeat(60) + '\n');
    }
}

// Run tests
const tester = new AccessibilityTester();
tester.runTests().catch(console.error);
