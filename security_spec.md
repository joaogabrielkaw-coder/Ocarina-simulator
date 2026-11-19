# Security Specification: Ocarina Simulator

## 1. Data Invariants
1. **Identity Ownership**: Every document in `/scores/{scoreId}` MUST have `scoreId == request.auth.uid` and `data.uid == request.auth.uid`.
2. **Email Verification**: Only verified authenticated users (`request.auth != null && request.auth.token.email_verified == true`) may create, update, or delete their leaderboard entry.
3. **Zero PII Exposure**: Leaderboard documents contain NO email addresses, phone numbers, or private metadata—only `playerName` (2..24 chars) and gameplay stats.
4. **Strict Bounds & Types**: `score` is an int in `[0, 9999999]`, `bestCombo` is an int in `[0, 9999]`, `accuracy` is a number in `[0, 100]`, `songsCompleted` is an int in `[0, 999]`, `mode == 'desafio'`, `isPublic == true`.
5. **Temporal Integrity**: `createdAt == request.time` on create; `createdAt` is immutable on update and `updatedAt == request.time` on update.
6. **High-Score Monotonicity**: On update, `incoming().score >= existing().score` (or updating `playerName` without lowering high score).
7. **Secure Public Listing**: `allow list` explicitly evaluates `resource.data.isPublic == true && resource.data.score >= 0`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Write**: Creating `/scores/user1` when `request.auth == null`.
2. **Unverified Email Write**: Creating `/scores/user1` when `request.auth.token.email_verified == false`.
3. **UID Spoofing on Create**: User `alice` tries to write `/scores/alice` with `{ uid: "bob", ... }`.
4. **Doc ID Spoofing**: User `alice` tries to write `/scores/bob` with `{ uid: "alice", ... }`.
5. **Shadow / Ghost Field Injection**: User `alice` adds `{ ..., isAdmin: true }` or `{ ..., verified: true }`.
6. **PII / Email Injection**: User `alice` adds `{ ..., email: "alice@example.com" }`.
7. **Score Overflow Poisoning**: `{ ..., score: 999999999 }` or `{ ..., score: -50 }`.
8. **Player Name Poisoning**: `{ ..., playerName: "A" }` (too short) or 200-char string (exceeds `maxLength: 24`).
9. **Client Timestamp Forgery**: `{ ..., createdAt: Timestamp(2020-01-01) }` instead of `request.time`.
10. **Immutable Field Tampering on Update**: Trying to mutate `uid`, `createdAt`, `mode`, or `isPublic` during an update.
11. **Score Downgrade / Arbitrary Overwrite**: Updating `score` to a negative value or string `"9999"`.
12. **Cross-User Update/Delete**: User `bob` attempts to update or delete `/scores/alice`.
