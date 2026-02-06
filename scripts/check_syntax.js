const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'frontend', 'YoursKanban.js');
const txt = fs.readFileSync(file, 'utf8');
function findUnbalanced(ch){
  let stack = 0;
  for(let i=0;i<txt.length;i++){
    if(txt[i]===ch) stack++;
  }
  return stack;
}
const braces = {'{':(txt.match(/\{/g)||[]).length, '}':(txt.match(/\}/g)||[]).length};
const paren = {'(': (txt.match(/\(/g)||[]).length, ')': (txt.match(/\)/g)||[]).length};
const brackets = {'[':(txt.match(/\[/g)||[]).length, ']':(txt.match(/\]/g)||[]).length};
const backticks = (txt.match(/`/g)||[]).length;
console.log('counts:', {braces, paren, brackets, backticks});

// Find last 200 characters and line number
const lines = txt.split(/\r?\n/);
console.log('total lines:', lines.length);
// Scan for unterminated template literal by finding a backtick with odd index
if(backticks % 2 !== 0){
  for(let i=0;i<lines.length;i++){
    if(lines[i].includes('`')){
      console.log('Line with backtick:', i+1, lines[i]);
    }
  }
}
// If braces mismatch, print last 60 lines
if(braces['{'] !== braces['}'] || paren['('] !== paren[')'] || brackets['['] !== brackets[']']){
  console.log('Potential mismatch. Printing last 120 lines:');
  const start = Math.max(0, lines.length-120);
  for(let i=start;i<lines.length;i++){
    console.log((i+1)+': '+lines[i]);
  }
}
