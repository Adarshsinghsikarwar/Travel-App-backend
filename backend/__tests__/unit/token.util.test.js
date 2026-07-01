// Unit: token utility
// No DB, no HTTP — pure function tests.
// These tokens protect every route so they're tested first.

process.env.ACCESS_TOKEN_SECRET = 'test_access_secret_1234567890';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_1234567890';
process.env.ACCESS_TOKEN_EXPIRY = '15m';
process.env.REFRESH_TOKEN_EXPIRY = '7d';
process.env.MONGO_URI = 'mongodb://localhost:27017/test';

const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = await import('../../src/utils/token.util.js');

describe('Token Utility', () => {
  const userId = '64f1a2b3c4d5e6f7a8b9c0d1';

  describe('generateAccessToken', () => {
    it('generates a 3-part JWT string', () => {
      const token = generateAccessToken(userId);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('embeds userId as sub claim', () => {
      const token = generateAccessToken(userId);
      const payload = verifyAccessToken(token);
      expect(payload.sub).toBe(userId);
    });
  });

  describe('generateRefreshToken', () => {
    it('generates a token different from the access token', () => {
      const access = generateAccessToken(userId);
      const refresh = generateRefreshToken(userId);
      expect(access).not.toBe(refresh);
    });
  });

  describe('verifyAccessToken', () => {
    it('verifies a valid access token', () => {
      const token = generateAccessToken(userId);
      const payload = verifyAccessToken(token);
      expect(payload.sub).toBe(userId);
    });

    it('rejects a refresh token used as an access token', () => {
      // refresh token is signed with a different secret — must never be accepted here
      const refreshToken = generateRefreshToken(userId);
      expect(() => verifyAccessToken(refreshToken)).toThrow();
    });

    it('rejects a tampered token', () => {
      const token = generateAccessToken(userId);
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyAccessToken(tampered)).toThrow();
    });

    it('rejects garbage input', () => {
      expect(() => verifyAccessToken('not.a.token')).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('verifies a valid refresh token', () => {
      const token = generateRefreshToken(userId);
      const payload = verifyRefreshToken(token);
      expect(payload.sub).toBe(userId);
    });

    it('rejects an access token used as a refresh token', () => {
      const accessToken = generateAccessToken(userId);
      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });
  });
});
