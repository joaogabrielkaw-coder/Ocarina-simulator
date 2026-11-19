import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSongSchedule,
  computeAccuracyPercent,
  computeHitPoints,
  computeNoteFrequency,
  evaluateNoteHit,
  matchSongSequence,
  OCARINA_SONGS,
  sanitizeLeaderboardPayload,
} from './musicData';
import {
  applyHoleTouchImpulse,
  createOcarinaPhysicsState,
  stepOcarinaPhysics,
} from './physics';

test('computeNoteFrequency calculates exact semitone bends', () => {
  assert.equal(computeNoteFrequency('RIGHT', 0), 440);
  const upOctave = computeNoteFrequency('RIGHT', 12);
  assert.ok(Math.abs(upOctave - 880) < 0.01);
  const downSemitone = computeNoteFrequency('RIGHT', -1);
  assert.ok(downSemitone < 440 && downSemitone > 410);
});

test('matchSongSequence detects canonical Ocarina melodies even after noise notes', () => {
  assert.equal(matchSongSequence(['A', 'DOWN']), null);
  const lullaby = matchSongSequence([
    'A',
    'A',
    'LEFT',
    'UP',
    'RIGHT',
    'LEFT',
    'UP',
    'RIGHT',
  ]);
  assert.ok(lullaby);
  assert.equal(lullaby.id, 'lullaby');

  const storms = matchSongSequence(['RIGHT', 'A', 'DOWN', 'UP', 'A', 'DOWN', 'UP']);
  assert.ok(storms);
  assert.equal(storms.id, 'storms');
});

test('rhythm grading and combo multiplier scoring work accurately', () => {
  assert.equal(evaluateNoteHit(0.05), 'perfeito');
  assert.equal(evaluateNoteHit(0.18), 'bom');
  assert.equal(evaluateNoteHit(0.4), 'erro');

  assert.equal(computeHitPoints('erro', 10), 0);
  assert.equal(computeHitPoints('perfeito', 1), 150);
  assert.equal(computeHitPoints('perfeito', 5), 225);
  assert.equal(computeHitPoints('perfeito', 30), 600);

  assert.equal(computeAccuracyPercent(8, 2, 10), 94);
  assert.equal(computeAccuracyPercent(0, 0, 0), 100);
});

test('buildSongSchedule generates ascending timestamps scaled by tempo', () => {
  const song = OCARINA_SONGS[0];
  const schedule = buildSongSchedule(song, 2.0, 1.0);
  assert.equal(schedule.length, song.chartBeats.length);
  assert.equal(schedule[0].targetTimeSec, 2.0);
  assert.ok(schedule[1].targetTimeSec > schedule[0].targetTimeSec);
});

test('sanitizeLeaderboardPayload enforces firebase-blueprint bounds', () => {
  assert.equal(
    sanitizeLeaderboardPayload({
      uid: 'invalid uid with spaces!',
      playerName: 'Link',
      score: 100,
      bestCombo: 5,
      accuracy: 90,
      songsCompleted: 1,
    }),
    null,
  );

  const valid = sanitizeLeaderboardPayload({
    uid: 'user_123-ABC',
    playerName: '  A  ',
    score: 99999999,
    bestCombo: -5,
    accuracy: 104.2,
    songsCompleted: 12.6,
  });
  assert.ok(valid);
  assert.equal(valid.playerName, 'Viajante');
  assert.equal(valid.score, 9999999);
  assert.equal(valid.bestCombo, 0);
  assert.equal(valid.accuracy, 100);
  assert.equal(valid.songsCompleted, 13);
  assert.equal(valid.mode, 'desafio');
  assert.equal(valid.isPublic, true);
});

test('Ocarina spring physics responds to hole touch and damps smoothly back to rest', () => {
  const phys = createOcarinaPhysicsState();
  applyHoleTouchImpulse(phys, 'A', true, 1.0);
  for (let i = 0; i < 5; i++) {
    stepOcarinaPhysics(phys, 1, 0.016, i * 0.016);
  }
  assert.ok(phys.tiltZ.value > 0.01, 'pressing left hole A should roll Ocarina');
  for (let i = 5; i < 20; i++) {
    stepOcarinaPhysics(phys, 1, 0.016, i * 0.016);
  }
  assert.ok(phys.holes.A.value > 0.6, 'hole A should depress toward 1');

  applyHoleTouchImpulse(phys, 'A', false, 1.0);
  for (let i = 0; i < 60; i++) {
    stepOcarinaPhysics(phys, 0, 0.016, 1 + i * 0.016);
  }
  assert.ok(phys.holes.A.value < 0.08, 'hole A should return near 0 after release');
});
