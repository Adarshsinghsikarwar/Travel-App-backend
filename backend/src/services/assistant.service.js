// ============================================================================
// AI TRAVEL ASSISTANT (RAG = "Retrieval-Augmented Generation")
// ----------------------------------------------------------------------------
// Plain explanation: instead of letting the AI just guess an answer from
// what it learned during training, we let it ASK OUR DATABASE for real facts
// first, and THEN answer using those facts. That is what "RAG" means here.
//
// We give the AI three "tools" — just plain JavaScript functions it is
// allowed to ask us to run:
//   1. search_providers     -> find REAL verified providers by city/type
//   2. get_provider_reviews -> read REAL reviews for one provider
//   3. get_booking_status   -> check the status of ONE of the CURRENT user's
//                              OWN bookings (never anyone else's — see below)
//
// The AI never touches MongoDB directly. It can only ask us to call one of
// these functions; we run it ourselves and hand back plain data.
// ============================================================================

import providerRepo from "../repositories/provider.repository.js";
import reviewRepo from "../repositories/review.repository.js";
import bookingRepo from "../repositories/booking.repository.js";
import ApiError from "../utils/ApiError.js";
import { runToolLoop, AINotConfiguredError } from "../utils/mistalClient.js";
import logger from "../utils/logger.js";

const SYSTEM_PROMPT = `You are a helpful travel assistant for TripConnect, a trip-planning and
local-service marketplace. Answer traveler questions using these tools to ground your answers
in REAL data:
- "search_providers" and "get_provider_reviews" for questions about local guides/drivers/homestays.
- "get_booking_status" ONLY when the user asks about one of their OWN bookings.

Rules:
- Never invent a provider, price, review, or booking detail that a tool did not return.
- If a tool returns no relevant results, say so honestly instead of guessing.
- Keep answers conversational and under 150 words.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_providers",
      description:
        "Search verified local service providers by city and/or service type.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string" },
          serviceType: {
            type: "string",
            enum: [
              "guide",
              "driver",
              "homestay",
              "planner",
              "photographer",
              "other",
            ],
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_provider_reviews",
      description:
        'Fetch real traveler reviews for a specific provider by its id, to assess quality/fit for a question like "is this guide good for families?".',
      parameters: {
        type: "object",
        properties: {
          providerId: {
            type: "string",
            description: "Mongo ObjectId of the provider",
          },
        },
        required: ["providerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_booking_status",
      description:
        "Check the status (requested/confirmed/completed/cancelled etc.) and details of one of the CURRENT logged-in user's own bookings, given a booking id.",
      parameters: {
        type: "object",
        properties: {
          bookingId: {
            type: "string",
            description: "Mongo ObjectId of the booking to check",
          },
        },
        required: ["bookingId"],
      },
    },
  },
];

async function searchProvidersTool({ city, serviceType }) {
  const { results } = await providerRepo.search({
    city,
    serviceType,
    page: 1,
    limit: 5,
  });
  return results.map((p) => ({
    id: p._id,
    title: p.title,
    serviceType: p.serviceType,
    pricePerDay: p.pricePerDay,
    avgRating: p.avgRating,
    city: p.location?.city,
  }));
}

async function getProviderReviewsTool({ providerId }) {
  const reviews = await reviewRepo.findByProvider(providerId);
  if (!reviews.length)
    return { message: "No reviews found for this provider yet." };
  return reviews
    .slice(0, 10)
    .map((r) => ({ rating: r.rating, comment: r.comment }));
}

// userId is the logged-in user's id, taken from their JWT access token. We
// receive it from outside (see AssistantService.ask below) and use it here
// to make sure this tool can ONLY ever return a booking that belongs to
// THIS user — never someone else's, no matter what id the AI asks for.
function makeGetBookingStatusTool(userId) {
  return async function getBookingStatusTool({ bookingId }) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) return { message: "No booking found with that id." };

    const belongsToCurrentUser =
      String(booking.traveler._id || booking.traveler) === String(userId);
    if (!belongsToCurrentUser) {
      // We deliberately do NOT say "this belongs to someone else" — just a
      // generic "can't access" message, so the AI can't use this to probe
      // whether a given booking id exists for another user.
      return { message: "You do not have access to this booking." };
    }

    return {
      status: booking.status,
      startDate: booking.startDate,
      endDate: booking.endDate,
      amount: booking.amount,
      providerTitle: booking.provider?.title,
    };
  };
}

class AssistantService {
  // userId is required now (it wasn't before) because get_booking_status
  // needs to know WHO is asking, so it only ever shows that person's own data.
  async ask(userId, question) {
    if (!question?.trim()) throw new ApiError(400, "question is required");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question },
    ];

    try {
      const answer = await runToolLoop({
        messages,
        tools: TOOLS,
        toolImplementations: {
          search_providers: searchProvidersTool,
          get_provider_reviews: getProviderReviewsTool,
          get_booking_status: makeGetBookingStatusTool(userId),
        },
      });

      if (!answer)
        throw new ApiError(502, "Assistant did not return an answer in time");
      return { answer };
    } catch (err) {
      if (err instanceof AINotConfiguredError) {
        throw new ApiError(
          503,
          "The travel assistant is not configured on this server"
        );
      }
      if (err instanceof ApiError) throw err;
      logger.error(`Assistant error: ${err.message}`);
      throw new ApiError(
        502,
        "The travel assistant is temporarily unavailable"
      );
    }
  }
}

export default new AssistantService();
