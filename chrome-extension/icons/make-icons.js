const fs = require('fs');
const path = require('path');

// 16x16 / 48x48 icon base64
const purplePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAZklEQVR42u3PMQEAAAgEIPuX1hrei4EN7JIAAAAAAAAAgLsBG9i1gA3sWsAGdi1gA7sWsIFdC9jArgVsYNcCNrBrARvYtYAGdi1gA7sWsIFdC9jArgVsYNcCNrBrARvYtYAGdi1gAwfcA4K5u753y+8LAAAAAElFTkSuQmCC", "base64");

fs.writeFileSync(path.join(__dirname, 'icon-16.png'), purplePng);
fs.writeFileSync(path.join(__dirname, 'icon-48.png'), purplePng);
fs.writeFileSync(path.join(__dirname, 'icon-128.png'), purplePng);
console.log('Icons generated successfully');
