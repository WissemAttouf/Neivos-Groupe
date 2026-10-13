const fs = require('fs');
let data = fs.readFileSync('public/admin.html', 'utf8');
data = data.replace(/\\`/g, '`');
data = data.replace(/\\\$/g, '$');
fs.writeFileSync('public/admin.html', data);