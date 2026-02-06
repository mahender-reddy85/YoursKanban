const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'frontend', 'YoursKanban.js');
const txt = fs.readFileSync(file, 'utf8');
const lines = txt.split(/\r?\n/);
let balance = 0;
let maxBalance = 0;
let maxLine = 0;
for(let i=0;i<lines.length;i++){
  const l = lines[i];
  for(const ch of l){
    if(ch==='{') balance++;
    else if(ch==='}') balance--;
  }
  if(balance>maxBalance){ maxBalance=balance; maxLine=i+1 }
}
console.log('final balance:', balance, 'maxBalance:', maxBalance, 'maxLine:', maxLine);
// Print surrounding lines around maxLine
const start = Math.max(0, maxLine-10);
const end = Math.min(lines.length, maxLine+10);
console.log('Context around max imbalance:');
for(let i=start;i<end;i++){
  console.log((i+1)+': '+lines[i]);
}
