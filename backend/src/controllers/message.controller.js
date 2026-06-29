import messageService from "../services/message.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

const sendMessage = asyncHandler(async (req, res) => {
  const message = await messageService.send(
    req.userId,
    req.params.bookingId,
    req.body.text
  );
  res.status(201).json(new ApiResponse(201, message));
});

const getThread = asyncHandler(async (req, res) => {
  const messages = await messageService.getThread(
    req.params.bookingId,
    req.userId
  );
  res.status(200).json(new ApiResponse(200, messages));
});

export { sendMessage, getThread };
