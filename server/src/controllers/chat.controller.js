const chatService = require('../services/chat.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

const chatController = {
  history: asyncHandler(async (req, res) => {
    const messages = await chatService.getHistory(req.userId);
    return ok(res, { messages });
  }),

  send: asyncHandler(async (req, res) => {
    const result = await chatService.send(req.userId, req.body.message);
    return ok(res, result);
  }),

  clear: asyncHandler(async (req, res) => {
    await chatService.clear(req.userId);
    return ok(res, null, 'Chat history cleared');
  }),
};

module.exports = chatController;