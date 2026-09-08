'use strict';
const mongoose = require('mongoose');

// One document per finished game. The leaderboard shows each player's best (see leaderboard() in server.js).
const scoreSchema = new mongoose.Schema({
  username:   { type: String, required: true, trim: true, minlength: 2, maxlength: 16, match: /^[A-Za-z0-9_.-]+$/, index: true },
  score:      { type: Number, required: true, min: 0, max: 10_000_000, index: true,
                validate: { validator: Number.isInteger, message: 'score must be an integer' } },
  timestamp:  { type: Date, default: Date.now, index: true },
  // integrity bookkeeping (never shown to players)
  session:    { type: String, required: true, unique: true },   // ticket id -> exactly one submission per game session
  level:      { type: Number, min: 1, max: 1000 },
  eaten:      { type: Number, min: 0, max: 1_000_000 },
  durationMs: { type: Number, min: 0, max: 86_400_000 },
  ip:         { type: String, maxlength: 64 },
}, { versionKey: false });

scoreSchema.index({ score: -1, timestamp: 1 });      // top-N sorts
scoreSchema.index({ timestamp: -1, score: -1 });     // weekly window

module.exports = mongoose.model('Score', scoreSchema);
