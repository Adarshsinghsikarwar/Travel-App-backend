import bookingService from "../services/booking.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

const createBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.createBookingRequest(
    req.userId,
    req.body
  );
  res.status(201).json(new ApiResponse(201, booking, "Booking request sent"));
});

const respondToRequest = asyncHandler(async (req, res) => {
  const booking = await bookingService.respondToRequest(
    req.params.id,
    req.userId,
    req.body.decision
  );
  res
    .status(200)
    .json(new ApiResponse(200, booking, `Booking ${booking.status}`));
});

const verifyPayment = asyncHandler(async (req, res) => {
  const booking = await bookingService.verifyAndRecordPayment(
    req.params.id,
    req.body
  );
  res.status(200).json(new ApiResponse(200, booking, "Payment verified"));
});

const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.cancelBooking(
    req.params.id,
    req.userId,
    req.body.reason
  );
  res.status(200).json(new ApiResponse(200, booking, "Booking cancelled"));
});

const markCompleted = asyncHandler(async (req, res) => {
  const booking = await bookingService.markCompleted(req.params.id, req.userId);
  res
    .status(200)
    .json(new ApiResponse(200, booking, "Booking marked completed"));
});

const myBookingsAsTraveler = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getMyBookingsAsTraveler(req.userId);
  res.status(200).json(new ApiResponse(200, bookings));
});

const myBookingsAsProvider = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getMyBookingsAsProvider(req.userId);
  res.status(200).json(new ApiResponse(200, bookings));
});

export {
  createBooking,
  respondToRequest,
  verifyPayment,
  cancelBooking,
  markCompleted,
  myBookingsAsTraveler,
  myBookingsAsProvider,
};
