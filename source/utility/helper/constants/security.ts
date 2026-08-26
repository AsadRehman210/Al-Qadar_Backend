// bcrypt's cost factor — how many rounds of key stretching each hash gets.
// 8 (the old value here) is under today's recommended floor of 10 against
// GPU-accelerated cracking; 12 is the current common default. Centralized
// so every password-hashing call site stays in sync instead of six
// independently-hardcoded numbers.
export const BCRYPT_SALT_ROUNDS = 12;
