export class InputError extends Error {}
export class NotFoundError extends Error {}

export function handleUserWriteError(error, res, next) {
  if (error instanceof InputError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error.name === 'SequelizeUniqueConstraintError') {
    res.status(409).json({ error: 'A user with that username already exists' });
    return;
  }
  next(error);
}

export function handleInputError(error, res, next) {
  if (error instanceof InputError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  next(error);
}
