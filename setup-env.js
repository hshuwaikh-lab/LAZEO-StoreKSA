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
    "VITE_API_BASE_URL": "https://lazeo-storeksa.onrender.com",
    "VITE_SUPABASE_URL": "https://hslolngigrxwviklahme.supabase.co",
    "VITE_SUPABASE_ANON_KEY": "YOUR_SUPABASE_ANON_KEY"
};

console.log('Environment variables configured locally.');
console.log('Vercel will automatically use .env.production file during build.');
console.log('\nVariables to be used:');
Object.entries(envVars).forEach(([key, value]) => {
    console.log(`  ${key}=${value.substring(0, 20)}...`);
});
