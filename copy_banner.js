import fs from 'fs';
import path from 'path';
const source = "C:\\Users\\User\\.gemini\\antigravity\\brain\\2cc3ec2f-2125-4127-9512-c6bfb51da12d\\media__1784012507420.png";
const dest = "c:\\Users\\User\\OneDrive - Arche Global Private Limited\\archeride1.0-main\\archeride1.0-main\\frontend\\my-react-app\\public\\banner.png";
try {
  fs.copyFileSync(source, dest);
  console.log("Successfully copied banner image to", dest);
} catch (err) {
  console.error("Error copying file:", err);
}

