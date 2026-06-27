const fs = require('fs');
const path = require('path');

try {
    // Try reading from vercel's local project settings
    const projectPath = path.join(process.cwd(), '.vercel', 'project.json');
    if (fs.existsSync(projectPath)) {
        const projectConfig = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
        console.log('Project config found:', projectConfig);
    }
} catch {
    console.log('Config file not found, will use Vercel CLI auth');
}

const envVars = {
    "VITE_FIREBASE_API_KEY": "AIzaSyCnFRivCXPgIHJfgqjHuCENZCCOQK49hFY",
    "VITE_FIREBASE_AUTH_DOMAIN": "laszeo-store-ksa.firebaseapp.com",
    "VITE_FIREBASE_PROJECT_ID": "laszeo-store-ksa",
    "VITE_FIREBASE_STORAGE_BUCKET": "laszeo-store-ksa.firebasestorage.app",
    "VITE_FIREBASE_MESSAGING_SENDER_ID": "111955440984",
    "VITE_FIREBASE_APP_ID": "1:111955440984:web:aa196a06c398e3688c212d",
    "VITE_FIREBASE_MEASUREMENT_ID": "G-2ND5W5GNKJ",
    "VITE_API_BASE_URL": "http://localhost:5000"
};

console.log('Environment variables configured locally.');
console.log('Vercel will automatically use .env.production file during build.');
console.log('\nVariables to be used:');
Object.entries(envVars).forEach(([key, value]) => {
    console.log(`  ${key}=${value.substring(0, 20)}...`);
});
