#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const os = require('os');

const envPath = path.join(__dirname, '../../.env');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

function updateEnv(origins) {
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    // Replace existing ALLOWED_ORIGINS line
    envContent = envContent.replace(
      /ALLOWED_ORIGINS=.*/,
      `ALLOWED_ORIGINS=${origins}`
    );
  } else {
    // Create .env with defaults
    envContent = `PORT=3000
NODE_ENV=development
DB_DIALECT=sqlite
DB_STORAGE=./timetable.sqlite
SESSION_SECRET=super_secret_upath_key_2026
JWT_SECRET=upath_dev_secret_key_2026_minimum_length_32_ok
ALLOWED_ORIGINS=${origins}
IDENTITY_PROVIDER_URL=
IDENTITY_PROVIDER_API_KEY=
IDENTITY_PROVIDER_TIMEOUT_MS=20000
`;
  }
  
  fs.writeFileSync(envPath, envContent);
}

function startServer() {
  console.log('\n✓ Server starting on http://localhost:3000\n');
  try {
    execSync('node server/server.js', { stdio: 'inherit', cwd: path.join(__dirname, '../..') });
  } catch (e) {
    console.error('\n✗ Server startup failed');
    process.exit(1);
  }
}

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║     UPath Development Server Launcher                 ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

const localIPs = getLocalIPs();

console.log('Choose your testing environment:\n');
console.log('  1) 💻 Localhost only (Desktop/Laptop browser)');
console.log('  2) 📱 Phone on same WiFi (Mobile testing)');
console.log('  3) 🌐 Ngrok tunnel (External HTTPS access)');
if (localIPs.length > 0) {
  console.log('\n🔗 Detected local IPs: ' + localIPs.join(', '));
}
console.log('');

rl.question('Choose option (1-3): ', (answer) => {
  if (answer === '1') {
    // Localhost only
    updateEnv('http://localhost:3000,http://127.0.0.1:3000');
    console.log('\n📍 Desktop Mode: Localhost');
    startServer();
  } else if (answer === '2') {
    // Local IP - Phone testing
    if (localIPs.length === 0) {
      console.log('\n❌ No local IPv4 addresses found. Make sure you\'re connected to WiFi.');
      rl.close();
      process.exit(1);
    }
    
    let selectedIP = localIPs[0];
    if (localIPs.length === 1) {
      console.log(`\n✓ Using IP: ${selectedIP}`);
      updateEnv(`http://localhost:3000,http://127.0.0.1:3000,http://${selectedIP}:3000`);
      
      console.log('\n╔════════════════════════════════════════════════════════╗');
      console.log('║        📱 PHONE TESTING INSTRUCTIONS                   ║');
      console.log('╚════════════════════════════════════════════════════════╝\n');
      console.log(`📍 Your laptop IP: ${selectedIP}`);
      console.log(`\n🔗 OPEN THIS URL ON YOUR PHONE:\n`);
      console.log(`   http://${selectedIP}:3000\n`);
      console.log('📋 Make sure:\n');
      console.log('   ✓ Phone is on the SAME WiFi as your laptop');
      console.log('   ✓ Server is running on this window');
      console.log('   ✓ Copy the URL above to your phone browser\n');
      
      startServer();
    } else {
      console.log('\nMultiple local IPs found:');
      localIPs.forEach((ip, idx) => {
        console.log(`  ${idx + 1}) ${ip}`);
      });
      rl.question('\nSelect IP (1-' + localIPs.length + '): ', (ipChoice) => {
        const idx = parseInt(ipChoice) - 1;
        if (idx >= 0 && idx < localIPs.length) {
          selectedIP = localIPs[idx];
          console.log(`\n✓ Using IP: ${selectedIP}`);
          updateEnv(`http://localhost:3000,http://127.0.0.1:3000,http://${selectedIP}:3000`);
          
          console.log('\n╔════════════════════════════════════════════════════════╗');
          console.log('║        📱 PHONE TESTING INSTRUCTIONS                   ║');
          console.log('╚════════════════════════════════════════════════════════╝\n');
          console.log(`📍 Your laptop IP: ${selectedIP}`);
          console.log(`\n🔗 OPEN THIS URL ON YOUR PHONE:\n`);
          console.log(`   http://${selectedIP}:3000\n`);
          console.log('📋 Make sure:\n');
          console.log('   ✓ Phone is on the SAME WiFi as your laptop');
          console.log('   ✓ Server is running on this window');
          console.log('   ✓ Copy the URL above to your phone browser\n');
          
          startServer();
        } else {
          console.log('Invalid selection');
          rl.close();
          process.exit(1);
        }
      });
    }
  } else if (answer === '3') {
    // Ngrok
    updateEnv('http://localhost:3000,http://127.0.0.1:3000');
    console.log('\n🌐 Ngrok Mode');
    console.log('\n📋 SETUP INSTRUCTIONS:\n');
    console.log('  1. Open a NEW terminal window');
    console.log('  2. Run: ngrok http 3000');
    console.log('  3. Copy the HTTPS URL from ngrok');
    console.log('  4. Use it on your phone or external device\n');
    rl.question('Press Enter once ngrok is running...', () => {
      console.log('\n✓ Starting server...\n');
      startServer();
    });
  } else {
    console.log('❌ Invalid option');
    rl.close();
    process.exit(1);
  }
});

rl.on('close', () => {
  process.exit(0);
});

