
import * as managersModel from '../models/managers.model.js';

export const getMappings = async (req, res) => {
    try {
        const mappings = await managersModel.listMappings();
        res.json(mappings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getManagers = async (req, res) => {
    try {
        const managers = await managersModel.listManagers();
        res.json(managers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const createManager = async (req, res) => {
    try {
        const { manager_name, member_name } = req.body;
        if (!manager_name || !member_name) {
            return res.status(400).json({ message: 'Manager Name and Member Name are required' });
        }
        const mapping = await managersModel.addMapping(manager_name, member_name);
        res.status(201).json(mapping);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

export const removeManager = async (req, res) => {
    try {
        const { id } = req.params;
        await managersModel.deleteMapping(id);
        res.json({ message: 'Mapping removed' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

