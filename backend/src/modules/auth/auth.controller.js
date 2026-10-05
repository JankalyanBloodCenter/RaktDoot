'use strict';
const authService = require('./auth.service');

async function register(req, res, next) {
  try {
    const { name, email, password, role, phone, vehicle_type, vehicle_number } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email, and password are required.' });
    }
    const result = await authService.register({ name, email, password, role, phone, vehicle_type, vehicle_number });
    res.status(201).json({ success: true, message: 'Account created successfully! Welcome to Raktdoot.', data: result });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required.' });
    }
    const result = await authService.login({ email, password });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

function getMe(req, res, next) {
  try {
    const user = authService.getMe(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe };
