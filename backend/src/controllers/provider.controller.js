import providerService from "../services/provider.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

const registerProvider = asyncHandler(async (req, res) => {
  const provider = await providerService.registerProvider(req.userId, req.body);
  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        provider,
        "Provider profile created, pending verification"
      )
    );
});

const getProvider = asyncHandler(async (req, res) => {
  const provider = await providerService.getProvider(req.params.id);
  res.status(200).json(new ApiResponse(200, provider));
});

const searchProviders = asyncHandler(async (req, res) => {
  const result = await providerService.search(req.query);
  res.status(200).json(new ApiResponse(200, result));
});

const updateProvider = asyncHandler(async (req, res) => {
  const provider = await providerService.updateProvider(
    req.params.id,
    req.userId,
    req.body
  );
  res
    .status(200)
    .json(new ApiResponse(200, provider, "Provider profile updated"));
});

// Files arrive via multer+Cloudinary middleware — req.files[].path is the hosted URL
const uploadPhotos = asyncHandler(async (req, res) => {
  const urls = (req.files || []).map((f) => f.path);
  const provider = await providerService.addPhotos(
    req.params.id,
    req.userId,
    urls
  );
  res.status(200).json(new ApiResponse(200, provider, "Photos uploaded"));
});

const setVerification = asyncHandler(async (req, res) => {
  const provider = await providerService.setVerification(
    req.params.id,
    req.body.status
  );
  res
    .status(200)
    .json(new ApiResponse(200, provider, "Verification status updated"));
});

export {
  registerProvider,
  getProvider,
  searchProviders,
  updateProvider,
  uploadPhotos,
  setVerification,
};
