/**
 * Automated Accessibility Fixer
 * Updates all HTML files with accessibility improvements
 */

const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const htmlFiles = fs.readdirSync(publicDir).filter(file => file.endsWith('.html'));

console.log(`🔧 Fixing accessibility issues in ${htmlFiles.length} HTML files...\n`);

let totalFixed = 0;

htmlFiles.forEach(file => {
    const filePath = path.join(publicDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let fixed = 0;
    const originalContent = content;
    
    console.log(`📄 Processing ${file}...`);
    
    // 1. Add accessibility.css if not present
    if (!content.includes('accessibility.css')) {
        content = content.replace(
            /<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/,
            `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome`
        );
        content = content.replace(
            /(<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome[^>]*>)/,
            `$1\n    \n    <!-- Accessibility Styles -->\n    <link rel="stylesheet" href="accessibility.css">`
        );
        fixed++;
    }
    
    // 2. Add skip link if not present
    if (!content.includes('skip-link') && !content.includes('Skip to')) {
        content = content.replace(
            /(<body[^>]*>)/,
            `$1\n    <!-- Skip Navigation Link -->\n    <a href="#main-content" class="skip-link">Skip to main content</a>\n    `
        );
        fixed++;
    }
    
    // 3. Add role="banner" to header if not present
    if (content.includes('<header') && !content.includes('role="banner"')) {
        content = content.replace(
            /<header(\s+class="[^"]*")?/g,
            '<header role="banner"$1'
        );
        fixed++;
    }
    
    // 4. Add id="main-content" and role="main" to main if not present
    if (content.includes('<main') && !content.includes('id="main-content"')) {
        content = content.replace(
            /<main(\s+class="[^"]*")?/,
            '<main id="main-content" role="main"$1'
        );
        fixed++;
    }
    
    // 5. Add main tag if missing
    if (!content.includes('<main')) {
        // Try to wrap content after header
        content = content.replace(
            /(<!-- Main Content -->|<div class="container)/,
            '<main id="main-content" role="main">\n    $1'
        );
        // Add closing main before scripts
        content = content.replace(
            /(\s*<script)/,
            '\n</main>\n$1'
        );
        fixed++;
    }
    
    // 6. Add accessibility.js before </body> if not present
    if (!content.includes('accessibility.js')) {
        content = content.replace(
            /(<\/body>)/,
            `    \n    <!-- ARIA Live Regions -->\n    <div id="aria-live-polite" role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>\n    <div id="aria-live-assertive" role="alert" aria-live="assertive" aria-atomic="true" class="sr-only"></div>\n    \n    <!-- Accessibility JavaScript -->\n    <script src="accessibility.js"></script>\n$1`
        );
        fixed++;
    }
    
    // 7. Add aria-hidden to icon fonts
    content = content.replace(
        /<i class="fa[s|r|l|b] [^"]*">/g,
        (match) => {
            if (!match.includes('aria-hidden')) {
                return match.replace('>', ' aria-hidden="true">');
            }
            return match;
        }
    );
    
    // 8. Add role="dialog" and aria-modal to modals
    if (content.includes('class="modal') || content.includes('id="modal')) {
        content = content.replace(
            /<div([^>]*)(class="[^"]*modal[^"]*"|id="[^"]*modal[^"]*")([^>]*)>/gi,
            (match) => {
                let result = match;
                if (!match.includes('role="dialog"')) {
                    result = result.replace('>', ' role="dialog">');
                }
                if (!match.includes('aria-modal')) {
                    result = result.replace('>', ' aria-modal="true">');
                }
                return result;
            }
        );
        fixed++;
    }
    
    // 9. Add role="tablist" to tab containers
    if (content.includes('data-tab=') && !content.includes('role="tablist"')) {
        content = content.replace(
            /<div class="flex flex-wrap gap-1">/g,
            '<div role="tablist" aria-label="Navigation tabs" class="flex flex-wrap gap-1">'
        );
        fixed++;
    }
    
    // 10. Add role="tab" to tab buttons
    content = content.replace(
        /<button([^>]*)data-tab="([^"]*)"([^>]*)>/g,
        (match, before, tabName, after) => {
            if (!match.includes('role="tab"')) {
                return `<button${before}role="tab" aria-selected="false" aria-controls="${tabName}Content" data-tab="${tabName}"${after}>`;
            }
            return match;
        }
    );
    
    // 11. Add role="tabpanel" to tab content
    content = content.replace(
        /<div id="([^"]+)Content" class="tab-content/g,
        '<div id="$1Content" role="tabpanel" aria-labelledby="$1-tab" class="tab-content'
    );
    
    // 12. Add aria-label to buttons with only icons
    content = content.replace(
        /<button([^>]*)>\s*<i class="fa[s|r|l|b][^>]*><\/i>\s*<\/button>/g,
        (match) => {
            if (!match.includes('aria-label') && !match.includes('title')) {
                // Try to infer label from icon class
                const iconMatch = match.match(/fa-([a-z-]+)/);
                if (iconMatch) {
                    const iconName = iconMatch[1].replace(/-/g, ' ');
                    return match.replace('<button', `<button aria-label="${iconName}"`);
                }
            }
            return match;
        }
    );
    
    // 13. Add labels to inputs with placeholders but no labels
    content = content.replace(
        /<input([^>]*)id="([^"]*)"([^>]*)placeholder="([^"]*)"([^>]*)>/g,
        (match, before, id, middle, placeholder, after) => {
            // Check if there's already a label or aria-label
            const hasLabel = content.includes(`for="${id}"`);
            const hasAriaLabel = match.includes('aria-label');
            
            if (!hasLabel && !hasAriaLabel) {
                return match.replace('>', ` aria-label="${placeholder}">`);
            }
            return match;
        }
    );
    
    // 14. Add scope to table headers
    content = content.replace(
        /<th([^>]*)>/g,
        (match) => {
            if (!match.includes('scope=')) {
                return match.replace('>', ' scope="col">');
            }
            return match;
        }
    );
    
    // 15. Add aria-required to required inputs
    content = content.replace(
        /<input([^>]*)required([^>]*)>/g,
        (match) => {
            if (!match.includes('aria-required')) {
                return match.replace('required', 'required aria-required="true"');
            }
            return match;
        }
    );
    
    // Only write if changes were made
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  ✅ Fixed ${fixed} issues in ${file}`);
        totalFixed += fixed;
    } else {
        console.log(`  ℹ️  No changes needed for ${file}`);
    }
});

console.log(`\n✨ Complete! Fixed ${totalFixed} accessibility issues across ${htmlFiles.length} files.`);
console.log(`\n📋 Next steps:`);
console.log(`  1. Run: npm run test:a11y`);
console.log(`  2. Review the changes`);
console.log(`  3. Test with keyboard navigation`);
console.log(`  4. Test with screen readers`);
