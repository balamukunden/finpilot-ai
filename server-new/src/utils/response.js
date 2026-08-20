/**
 * Consistent success response envelope:
 * { success: true, message, data }
 */
function send(res, statusCode, data, message) {
  return res.status(statusCode).json({
    success: true,
    message: message || 'Success',
    data: data ?? null,
  });
}

function ok(res, data, message) {
  return send(res, 200, data, message);
}

function created(res, data, message) {
  return send(res, 201, data, message || 'Created successfully');
}

function noContent(res) {
  return res.status(204).end();
}

module.exports = { send, ok, created, noContent };