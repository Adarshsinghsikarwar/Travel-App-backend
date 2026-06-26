import tripService from "../services/trip.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

const createTrip = asyncHandler(async (req, res) => {
  const trip = await tripService.createTrip(req.userId, req.body);
  res.status(201).json(new ApiResponse(201, trip, "Trip created"));
});

const getMyTrips = asyncHandler(async (req, res) => {
  const { status, destination } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (destination) filters.destination = destination;

  const trips = await tripService.getMyTrips(req.userId, filters);
  res.status(200).json(new ApiResponse(200, trips));
});

const getTripById = asyncHandler(async (req, res) => {
  const trip = await tripService.getTripById(req.params.id, req.userId);
  res.status(200).json(new ApiResponse(200, trip));
});

const updateTrip = asyncHandler(async (req, res) => {
  const trip = await tripService.updateTrip(
    req.params.id,
    req.userId,
    req.body
  );

  res.status(200).json(new ApiResponse(200, trip, "Trip updated"));
});

const deleteTrip = asyncHandler(async (req, res) => {
  await tripService.deleteTrip(req.params.id, req.userId);
  res.status(200).json(new ApiResponse(200, null, "Trip deleted"));
});

export { createTrip, getMyTrips, getTripById, updateTrip, deleteTrip };
