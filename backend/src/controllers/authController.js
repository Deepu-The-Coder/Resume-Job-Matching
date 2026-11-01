import { parseInput } from '../middleware/validate.js';
import { authLoginSchema, authRegisterSchema } from '../schemas/apiSchemas.js';
import { login, register } from '../services/authService.js';

export async function registerUser(req, res, next) {
  try {
    res.status(201).json(await register(parseInput(authRegisterSchema, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function loginUser(req, res, next) {
  try {
    res.status(200).json(await login(parseInput(authLoginSchema, req.body)));
  } catch (error) {
    next(error);
  }
}
