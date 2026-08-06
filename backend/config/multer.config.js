
import multer from "multer";
import path from "path";
import fs from "fs";


const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        "application/pdf",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp",
        "application/vnd.ms-outlook",
        "application/octet-stream",
    ];

    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedExt = [".pdf", ".xlsx", ".xls", ".csv", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".webp", ".msg"].includes(ext);

    if (allowedMimeTypes.includes(file.mimetype) || (ext === ".msg" && file.mimetype === "application/octet-stream") || isAllowedExt) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Allowed: PDF, Excel, CSV, Word, Images (PNG/JPG/WEBP), .msg."), false);
    }
};

export function createUpload(subdir = "escalations") {
    const uploadDir = `uploads/${subdir}`;
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
            const ext = path.extname(file.originalname);
            cb(null, file.fieldname + "-" + uniqueSuffix + ext);
        },
    });

    return multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: { fileSize: 10 * 1024 * 1024 },
    });
}

const upload = createUpload("escalations");

export default upload;
