
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const DATA_FILE = path.join(__dirname, '..', 'data', 'managers_mapping.json');

// Ensure the data directory and file exist
const ensureFile = () => {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        // Initial sample data based on user request
        fs.writeFileSync(DATA_FILE, JSON.stringify([
            { id: '1', manager_name: 'Ajay', member_name: 'Vishal' },
            { id: '2', manager_name: 'Ajay', member_name: 'Sudhakar' },
            { id: '3', manager_name: 'Ajay', member_name: 'Nazim' },
            { id: '4', manager_name: 'Manoharan', member_name: 'Vignesh' }
        ], null, 2));
    }
};

export const listMappings = async () => {
    ensureFile();
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
};

export const listManagers = async () => {
    const mappings = await listMappings();
    const managers = [...new Set(mappings.map(m => m.manager_name))];
    return managers.map((name, index) => ({ id: (index + 1).toString(), name }));
};

export const listMembersByManager = async (managerName) => {
    const mappings = await listMappings();
    return mappings
        .filter(m => m.manager_name.toLowerCase() === managerName.toLowerCase())
        .map(m => m.member_name);
};

export const addMapping = async (manager_name, member_name) => {
    ensureFile();
    const mappings = await listMappings();
    if (mappings.find(m => 
        m.manager_name.toLowerCase() === manager_name.toLowerCase() && 
        m.member_name.toLowerCase() === member_name.toLowerCase()
    )) {
        throw new Error('Mapping already exists');
    }
    const newMapping = {
        id: Date.now().toString(),
        manager_name,
        member_name
    };
    mappings.push(newMapping);
    fs.writeFileSync(DATA_FILE, JSON.stringify(mappings, null, 2));
    return newMapping;
};

export const deleteMapping = async (id) => {
    ensureFile();
    let mappings = await listMappings();
    mappings = mappings.filter(m => m.id !== id);
    fs.writeFileSync(DATA_FILE, JSON.stringify(mappings, null, 2));
    return true;
};

