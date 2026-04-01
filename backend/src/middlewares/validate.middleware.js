/**
 * Generic Joi validation middleware.
 * Usage: router.post('/route', validate(schema), handler)
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(422).json({ error: 'Validation failed', details: messages });
    }
    req.body = value;
    next();
  };
}

module.exports = { validate };
