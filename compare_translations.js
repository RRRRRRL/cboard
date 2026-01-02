const fs = require('fs');

const enUS = JSON.parse(fs.readFileSync('src/translations/en-US.json', 'utf8'));
const zhTW = JSON.parse(fs.readFileSync('src/translations/zh-TW.json', 'utf8'));

const enUSKeys = Object.keys(enUS);
const zhTWKeys = Object.keys(zhTW);

const missingInZhTW = enUSKeys.filter(key => !(key in zhTW));

console.log('Missing translations in zh-TW:');
missingInZhTW.forEach(key => {
  console.log(`- ${key}`);
});

console.log(`\nTotal missing: ${missingInZhTW.length}`);

// Check for duplicate values in zh-TW
const valueMap = {};
const duplicates = [];
for (const [key, value] of Object.entries(zhTW)) {
  if (valueMap[value]) {
    duplicates.push({ key1: valueMap[value], key2: key, value });
  } else {
    valueMap[value] = key;
  }
}

if (duplicates.length > 0) {
  console.log('\nDuplicate translations in zh-TW (same value):');
  duplicates.forEach(dup => {
    console.log(`- "${dup.key1}" and "${dup.key2}": "${dup.value}"`);
  });
} else {
  console.log('\nNo duplicate translations found in zh-TW.');
}
