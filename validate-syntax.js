// Simple syntax validation script
const fs = require('fs');

function validateSyntax(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic syntax check using eval (not for production, just for validation)
    try {
      new Function(content);
      console.log(`✓ ${filePath} - Syntax is valid`);
      return true;
    } catch (syntaxError) {
      console.log(`✗ ${filePath} - Syntax error: ${syntaxError.message}`);
      return false;
    }
  } catch (error) {
    console.log(`✗ ${filePath} - Error reading file: ${error.message}`);
    return false;
  }
}

console.log('🔍 Validating JavaScript syntax...');
console.log('=====================================');

const files = [
  'server.js',
  'database.js',
  'test-authentication.js'
];

let allValid = true;

files.forEach(file => {
  if (!validateSyntax(file)) {
    allValid = false;
  }
});

console.log('=====================================');
if (allValid) {
  console.log('🎉 All files have valid syntax!');
} else {
  console.log('❌ Some files have syntax errors.');
}

// Check if required dependencies exist
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = [
    'express',
    'bcrypt',
    'jsonwebtoken',
    'helmet',
    'cors',
    'express-rate-limit',
    'better-sqlite3',
    'uuid'
  ];
  
  console.log('\n📦 Checking dependencies...');
  console.log('=====================================');
  
  let missingDeps = [];
  requiredDeps.forEach(dep => {
    if (!packageJson.dependencies[dep]) {
      console.log(`❌ Missing dependency: ${dep}`);
      missingDeps.push(dep);
    } else {
      console.log(`✓ Found dependency: ${dep}`);
    }
  });
  
  if (missingDeps.length === 0) {
    console.log('\n🎉 All required dependencies are present!');
  } else {
    console.log(`\n⚠️  Missing dependencies: ${missingDeps.join(', ')}`);
    console.log('Run: npm install to install missing dependencies');
  }
} catch (error) {
  console.log('❌ Error reading package.json:', error.message);
}
