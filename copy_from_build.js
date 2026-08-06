import fs from 'fs';

const source = "c:\\Users\\User\\OneDrive - Arche Global Private Limited\\archeride1.0-main\\archeride1.0-main\\frontend\\my-react-app\\build\\assets\\8ea19adb-4948-471f-9643-f06220d8c3e7.png";
const dest = "c:\\Users\\User\\OneDrive - Arche Global Private Limited\\archeride1.0-main\\archeride1.0-main\\frontend\\my-react-app\\public\\banner.png";

try {
  fs.copyFileSync(source, dest);
  console.log("Successfully copied banner image to public/banner.png!");
} catch (err) {
  console.error("Error copying file:", err);
}
