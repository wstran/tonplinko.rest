import fs from 'fs';

const bin = JSON.parse(fs.readFileSync('./src/bins/data.json', 'utf8'));

export default bin;