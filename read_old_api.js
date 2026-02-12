
const { execSync } = require('child_process');
const fs = require('fs');

try {
    const content = execSync('git show HEAD:public/js/api.js').toString();
    fs.writeFileSync('old_api_recovered.js', content);
    console.log('Successfully wrote old_api_recovered.js');
} catch (e) {
    console.error('Error:', e.message);
}
