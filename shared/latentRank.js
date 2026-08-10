/**
 * LatentRank v2 — 两级 Plackett–Luce、全史批量 MAP（纯函数、零依赖）。
 *
 * 一局全序拆成「队标交错 pattern × 两队各自队内序」。这个拆分在样本空间上
 * 是双射，但三项相乘仍是条件独立假设，不是数学证明；掼蛋接风可能让 pattern
 * 与队内序相关，必须持续看 diagnostics.conditionalOrder。
 *
 * lambda !== 1 时，lambda * log P(order) 不是归一化 log-likelihood。调 lambda
 * 只能使用 scoreLatentRank(...).temperedWithinLogLoss（m <= 4 时枚举至多 24 个排列完成正确
 * 归一化），禁止拿 combinedObjective 跨 lambda 比较。
 */

export const LATENT_RANK_VERSION = 'v2.0';
export const LATENT_RANK_SCALE = 400 / Math.log(10);
export const LATENT_RANK_DEFAULTS = Object.freeze({
  lambda: 0.35,
  rho: 0.2,
  teamAgg: 'mean',
  legacySigma: 0.5,
  newcomerSigma: 0.9,
  maxIterations: 80,
  tolerance: 1e-6,
  damping: 1e-8,
  uncertaintyPasses: 1,
  pairMinWeight: 3
});

const EPS = 1e-12;
const ALLOWED_MODES = new Set([4, 6, 8]);

export class LatentRankInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LatentRankInputError';
    this.code = code;
  }
}

export class LatentRankSolveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LatentRankSolveError';
    this.code = 'solver_not_converged';
  }
}

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function positive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function stableHandle(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function sum(values) {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

function dot(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += a[i] * b[i];
  return total;
}

function logSumExp(values) {
  let max = -Infinity;
  for (const value of values) if (value > max) max = value;
  if (!Number.isFinite(max)) return max;
  let total = 0;
  for (const value of values) total += Math.exp(value - max);
  return max + Math.log(total);
}

function addOuter(matrix, vector, factor) {
  for (let i = 0; i < vector.length; i += 1) {
    const vi = vector[i];
    if (vi === 0) continue;
    for (let j = 0; j <= i; j += 1) {
      const value = factor * vi * vector[j];
      if (value === 0) continue;
      matrix[i][j] += value;
      if (i !== j) matrix[j][i] += value;
    }
  }
}

function zeroMatrix(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function cholesky(matrix) {
  const n = matrix.length;
  const lower = zeroMatrix(n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let value = matrix[i][j];
      for (let k = 0; k < j; k += 1) value -= lower[i][k] * lower[j][k];
      if (i === j) {
        if (!(value > 0) || !Number.isFinite(value)) {
          throw new Error(`LatentRank precision is not positive definite at row ${i}`);
        }
        lower[i][j] = Math.sqrt(value);
      } else {
        lower[i][j] = value / lower[j][j];
      }
    }
  }
  return lower;
}

function solveCholesky(lower, rhs) {
  const n = lower.length;
  const y = Array(n).fill(0);
  const x = Array(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    let value = rhs[i];
    for (let j = 0; j < i; j += 1) value -= lower[i][j] * y[j];
    y[i] = value / lower[i][i];
  }
  for (let i = n - 1; i >= 0; i -= 1) {
    let value = y[i];
    for (let j = i + 1; j < n; j += 1) value -= lower[j][i] * x[j];
    x[i] = value / lower[i][i];
  }
  return x;
}

function inverseFromCholesky(lower) {
  const n = lower.length;
  const inverse = zeroMatrix(n);
  for (let column = 0; column < n; column += 1) {
    const unit = Array(n).fill(0);
    unit[column] = 1;
    const solved = solveCholesky(lower, unit);
    for (let row = 0; row < n; row += 1) inverse[row][column] = solved[row];
  }
  return inverse;
}

function conditionedCovariance(precision) {
  const lower = cholesky(precision);
  const inverse = inverseFromCholesky(lower);
  const ones = Array(precision.length).fill(1);
  const anchorDirection = solveCholesky(lower, ones);
  const denominator = sum(anchorDirection);
  const covariance = zeroMatrix(precision.length);
  for (let i = 0; i < precision.length; i += 1) {
    for (let j = 0; j < precision.length; j += 1) {
      covariance[i][j] = inverse[i][j]
        - (anchorDirection[i] * anchorDirection[j]) / denominator;
    }
  }
  return covariance;
}

function withParams(overrides = {}) {
  const params = { ...LATENT_RANK_DEFAULTS, ...(overrides || {}) };
  if (!(params.lambda > 0 && params.lambda <= 1)) {
    throw new LatentRankInputError('invalid_lambda', 'lambda must be in (0, 1]');
  }
  if (!(params.rho >= 0 && params.rho <= 1)) {
    throw new LatentRankInputError('invalid_rho', 'rho must be in [0, 1]');
  }
  if (params.teamAgg !== 'mean' && params.teamAgg !== 'sum') {
    throw new LatentRankInputError('invalid_team_agg', "teamAgg must be 'mean' or 'sum'");
  }
  params.maxIterations = Math.max(1, Math.floor(positive(params.maxIterations, 80)));
  params.tolerance = positive(params.tolerance, LATENT_RANK_DEFAULTS.tolerance);
  params.damping = positive(params.damping, 1e-8);
  params.legacySigma = positive(params.legacySigma, LATENT_RANK_DEFAULTS.legacySigma);
  params.newcomerSigma = positive(params.newcomerSigma, LATENT_RANK_DEFAULTS.newcomerSigma);
  params.uncertaintyPasses = clamp(Math.floor(finite(params.uncertaintyPasses, 1)), 0, 1);
  params.pairMinWeight = Math.max(0, finite(params.pairMinWeight, 3));
  return params;
}

/** Effective information after G correlated hands. */
export function effectiveHands(handCount, rho = LATENT_RANK_DEFAULTS.rho) {
  const g = Math.max(0, finite(handCount));
  if (g === 0) return 0;
  const r = clamp(finite(rho, LATENT_RANK_DEFAULTS.rho), 0, 1);
  return g / (1 + (g - 1) * r);
}

/** Fixed marginal evidence for the kth hand; never retroactively renormalized. */
export function marginalHandWeight(handNumber, rho = LATENT_RANK_DEFAULTS.rho) {
  const k = Math.max(1, Math.floor(finite(handNumber, 1)));
  return effectiveHands(k, rho) - effectiveHands(k - 1, rho);
}

/** Legacy beat-rate prior specified by ladder v2 §1.4. */
export function priorFromLegacy(input = {}, params = {}) {
  const merged = withParams(params);
  const games = Math.max(0, finite(input.games ?? input.hands));
  const beatRate = Number(input.legacyBeatRate ?? input.beatRate);
  const hasLegacy = games > 0 && Number.isFinite(beatRate);
  const confidence = hasLegacy ? Math.min(games, 20) / 20 : 0;
  const centered = hasLegacy ? clamp(2 * (beatRate - 0.5), -0.8, 0.8) : 0;
  return {
    mu0: confidence * centered,
    sigma0: hasLegacy ? merged.legacySigma : merged.newcomerSigma,
    hasLegacy,
    games
  };
}

function normalizePrior(raw, params) {
  if (raw && (raw.legacyBeatRate !== undefined || raw.beatRate !== undefined)) {
    const derived = priorFromLegacy(raw, params);
    return { ...raw, ...derived };
  }
  const hasLegacy = Boolean(raw?.hasLegacy);
  return {
    ...(raw || {}),
    mu0: finite(raw?.mu0),
    sigma0: positive(raw?.sigma0, hasLegacy ? params.legacySigma : params.newcomerSigma),
    hasLegacy
  };
}

function matchIdOf(match) {
  const value = match?._id ?? match?.matchId ?? match?.id;
  return typeof value === 'string' ? value.trim() : '';
}

function validateRoster(match, matchId) {
  const roster = Array.isArray(match?.roster) ? match.roster : [];
  const mode = Number(match?.mode ?? roster.length);
  if (!ALLOWED_MODES.has(mode) || roster.length !== mode || mode % 2 !== 0) {
    throw new LatentRankInputError(
      'incomplete_roster',
      `${matchId}: roster must contain exactly 4, 6, or 8 players`
    );
  }
  const seen = new Set();
  const normalized = roster.map((player, rosterIndex) => {
    const handle = stableHandle(player?.handle);
    const team = Number(player?.team);
    if (!handle || (team !== 1 && team !== 2) || seen.has(handle)) {
      throw new LatentRankInputError(
        'invalid_roster_identity',
        `${matchId}: every roster seat needs a unique canonical handle and team 1/2`
      );
    }
    seen.add(handle);
    return { handle, team, rosterIndex };
  });
  const team1 = normalized.filter((player) => player.team === 1);
  const team2 = normalized.filter((player) => player.team === 2);
  if (team1.length !== mode / 2 || team2.length !== mode / 2) {
    throw new LatentRankInputError(
      'incomplete_roster',
      `${matchId}: both teams must contain mode/2 players`
    );
  }
  return normalized;
}

function normalizeHand(raw, roster, matchId, handIndex) {
  if (!Array.isArray(raw) || raw.length !== roster.length) {
    throw new LatentRankInputError(
      'incomplete_hand',
      `${matchId}#${handIndex + 1}: hand must rank every roster seat exactly once`
    );
  }
  const order = [];
  const seen = new Set();
  for (const value of raw) {
    const rosterIndex = Number(value);
    if (!Number.isInteger(rosterIndex) || rosterIndex < 0 || rosterIndex >= roster.length || seen.has(rosterIndex)) {
      throw new LatentRankInputError(
        'invalid_hand_permutation',
        `${matchId}#${handIndex + 1}: hand is not a full roster-index permutation`
      );
    }
    seen.add(rosterIndex);
    order.push(rosterIndex);
  }
  return order;
}

function prepareInput(matches, priors, params) {
  const sourceMatches = Array.isArray(matches) ? matches : [];
  const active = [];
  const matchIds = new Set();
  const priorByHandle = new Map();
  for (const [rawHandle, prior] of Object.entries(priors || {})) {
    const handle = stableHandle(rawHandle);
    if (!handle) continue;
    if (priorByHandle.has(handle)) {
      throw new LatentRankInputError('duplicate_prior', `duplicate normalized prior handle: ${handle}`);
    }
    priorByHandle.set(handle, prior);
  }
  const handles = new Set(priorByHandle.keys());

  for (const match of sourceMatches) {
    if (match?.revoked === true) continue;
    const matchId = matchIdOf(match);
    if (!matchId || matchIds.has(matchId)) {
      throw new LatentRankInputError(
        matchId ? 'duplicate_match' : 'missing_match_id',
        matchId ? `duplicate match id: ${matchId}` : 'every match needs a stable _id/matchId'
      );
    }
    matchIds.add(matchId);
    const roster = validateRoster(match, matchId);
    roster.forEach((player) => handles.add(player.handle));
    const hands = Array.isArray(match?.hands)
      ? match.hands.map((hand, index) => normalizeHand(hand, roster, matchId, index))
      : [];
    active.push({ matchId, roster, hands });
  }

  const orderedHandles = [...handles].sort((a, b) => a.localeCompare(b, 'en'));
  const indexByHandle = new Map(orderedHandles.map((handle, index) => [handle, index]));
  const normalizedPriors = orderedHandles.map((handle) => normalizePrior(priorByHandle.get(handle), params));
  const observations = [];

  active.sort((a, b) => a.matchId.localeCompare(b.matchId, 'en'));
  for (const match of active) {
    const roster = match.roster.map((player) => ({
      ...player,
      index: indexByHandle.get(player.handle)
    }));
    const team1 = roster.filter((player) => player.team === 1).map((player) => player.index);
    const team2 = roster.filter((player) => player.team === 2).map((player) => player.index);
    for (let handIndex = 0; handIndex < match.hands.length; handIndex += 1) {
      const rosterOrder = match.hands[handIndex];
      const order = rosterOrder.map((rosterIndex) => roster[rosterIndex].index);
      const teams = rosterOrder.map((rosterIndex) => roster[rosterIndex].team);
      observations.push({
        id: `${match.matchId}#${String(handIndex + 1).padStart(4, '0')}`,
        matchId: match.matchId,
        handNumber: handIndex + 1,
        weight: marginalHandWeight(handIndex + 1, params.rho),
        order,
        teams,
        team1,
        team2
      });
    }
  }

  return {
    handles: orderedHandles,
    priors: normalizedPriors,
    observations,
    matchesUsed: active.length
  };
}

/** Glicko-style multiway temperature. One scalar per choice set preserves shift invariance. */
function uncertaintyScale(indices, sigmas) {
  if (!sigmas || indices.length === 0) return 1;
  let variance = 0;
  for (const index of indices) variance += sigmas[index] * sigmas[index];
  variance /= indices.length;
  return 1 / Math.sqrt(1 + (3 * variance) / (Math.PI * Math.PI));
}

function teamAggDerivative(teamSize, params) {
  return params.teamAgg === 'sum' ? 1 : 1 / teamSize;
}

function teamStrength(theta, indices, params) {
  let value = 0;
  for (const index of indices) value += theta[index];
  return params.teamAgg === 'mean' ? value / indices.length : value;
}

function addPatternTerm(state, observation, theta, sigmas, params) {
  const { gradient, precision } = state;
  const roster = observation.team1.concat(observation.team2);
  const scale = uncertaintyScale(roster, sigmas);
  const strength1 = teamStrength(theta, observation.team1, params);
  const strength2 = teamStrength(theta, observation.team2, params);
  const logStrength1 = scale * strength1;
  const logStrength2 = scale * strength2;
  const derivative = Array(theta.length).fill(0);
  const d1 = teamAggDerivative(observation.team1.length, params);
  const d2 = teamAggDerivative(observation.team2.length, params);
  for (const index of observation.team1) derivative[index] = d1;
  for (const index of observation.team2) derivative[index] = -d2;

  let remaining1 = observation.team1.length;
  let remaining2 = observation.team2.length;
  for (const chosenTeam of observation.teams) {
    if (remaining1 === 0 || remaining2 === 0) break;
    const logWeight1 = Math.log(remaining1) + logStrength1;
    const logWeight2 = Math.log(remaining2) + logStrength2;
    const denominator = logSumExp([logWeight1, logWeight2]);
    const probability1 = Math.exp(logWeight1 - denominator);
    const outcome1 = chosenTeam === 1 ? 1 : 0;
    state.objective += observation.weight
      * ((outcome1 ? logWeight1 : logWeight2) - denominator);
    if (gradient) {
      const residual = observation.weight * scale * (outcome1 - probability1);
      for (let i = 0; i < derivative.length; i += 1) gradient[i] += residual * derivative[i];
      addOuter(
        precision,
        derivative,
        observation.weight * scale * scale * probability1 * (1 - probability1)
      );
    }
    if (chosenTeam === 1) remaining1 -= 1;
    else remaining2 -= 1;
  }
}

function teamOrder(observation, team) {
  const memberSet = new Set(team === 1 ? observation.team1 : observation.team2);
  return observation.order.filter((index) => memberSet.has(index));
}

function orderLogProbability(order, theta, scale = 1) {
  let logProbability = 0;
  const remaining = order.slice();
  while (remaining.length > 1) {
    const chosen = remaining[0];
    const logits = remaining.map((index) => scale * theta[index]);
    logProbability += scale * theta[chosen] - logSumExp(logits);
    remaining.shift();
  }
  return logProbability;
}

function addWithinOrderTerm(state, order, observation, theta, sigmas, params) {
  const remaining = order.slice();
  while (remaining.length > 1) {
    const chosen = remaining[0];
    const scale = uncertaintyScale(remaining, sigmas);
    const logits = remaining.map((index) => scale * theta[index]);
    const denominator = logSumExp(logits);
    const probabilities = logits.map((value) => Math.exp(value - denominator));
    const factor = observation.weight * params.lambda;
    state.objective += factor * (scale * theta[chosen] - denominator);

    if (state.gradient) {
      for (let a = 0; a < remaining.length; a += 1) {
        const index = remaining[a];
        state.gradient[index] += factor * scale * ((index === chosen ? 1 : 0) - probabilities[a]);
      }
      for (let a = 0; a < remaining.length; a += 1) {
        const i = remaining[a];
        for (let b = 0; b < remaining.length; b += 1) {
          const j = remaining[b];
          const fisher = (a === b ? probabilities[a] : 0) - probabilities[a] * probabilities[b];
          state.precision[i][j] += factor * scale * scale * fisher;
        }
      }
    }
    remaining.shift();
  }
}

function evaluatePrepared(prepared, theta, sigmas, params, derivatives = true) {
  const size = prepared.handles.length;
  const state = {
    objective: 0,
    gradient: derivatives ? Array(size).fill(0) : null,
    precision: derivatives ? zeroMatrix(size) : null
  };

  for (let i = 0; i < size; i += 1) {
    const prior = prepared.priors[i];
    const difference = theta[i] - prior.mu0;
    const priorPrecision = 1 / (prior.sigma0 * prior.sigma0);
    state.objective -= 0.5 * priorPrecision * difference * difference;
    if (derivatives) {
      state.gradient[i] -= priorPrecision * difference;
      state.precision[i][i] += priorPrecision;
    }
  }

  for (const observation of prepared.observations) {
    addPatternTerm(state, observation, theta, sigmas, params);
    addWithinOrderTerm(state, teamOrder(observation, 1), observation, theta, sigmas, params);
    addWithinOrderTerm(state, teamOrder(observation, 2), observation, theta, sigmas, params);
  }
  return state;
}

function enforceAnchor(theta, targetSum) {
  if (theta.length === 0) return theta;
  let firstTotal = 0;
  for (let i = 0; i < theta.length - 1; i += 1) firstTotal += theta[i];
  theta[theta.length - 1] = targetSum - firstTotal;
  return theta;
}

function solveMap(prepared, params, sigmas, warmStart) {
  const size = prepared.handles.length;
  if (size === 0) {
    return { theta: [], covariance: [], objective: 0, iterations: 0, converged: true };
  }
  // Mixed sigma0 values make the unconstrained independent-Gaussian MAP's
  // unweighted sum drift. The product contract requires the public pool scale
  // to obey Σtheta = Σmu0 exactly, so Newton runs on that anchored subspace.
  const targetSum = sum(prepared.priors.map((prior) => prior.mu0));
  const theta = prepared.handles.map((handle, index) => {
    const value = warmStart?.[handle];
    return Number.isFinite(Number(value)) ? Number(value) : prepared.priors[index].mu0;
  });
  enforceAnchor(theta, targetSum);

  let converged = false;
  let iterations = 0;
  for (; iterations < params.maxIterations; iterations += 1) {
    const current = evaluatePrepared(prepared, theta, sigmas, params, true);
    const meanGradient = sum(current.gradient) / size;
    let maxProjectedGradient = 0;
    for (const value of current.gradient) {
      maxProjectedGradient = Math.max(maxProjectedGradient, Math.abs(value - meanGradient));
    }
    if (maxProjectedGradient <= params.tolerance) {
      converged = true;
      break;
    }

    let accepted = false;
    let damping = params.damping;
    for (let attempt = 0; attempt < 8 && !accepted; attempt += 1) {
      const damped = current.precision.map((row, i) => row.map((value, j) => (
        i === j ? value + damping : value
      )));
      const lower = cholesky(damped);
      const rawStep = solveCholesky(lower, current.gradient);
      const anchorDirection = solveCholesky(lower, Array(size).fill(1));
      const correction = sum(rawStep) / sum(anchorDirection);
      const step = rawStep.map((value, i) => value - correction * anchorDirection[i]);
      const slope = dot(current.gradient, step);
      if (!(slope > 0) || !Number.isFinite(slope)) {
        damping *= 10;
        continue;
      }

      let stepSize = 1;
      for (let backtrack = 0; backtrack < 24; backtrack += 1) {
        const candidate = theta.map((value, i) => value + stepSize * step[i]);
        enforceAnchor(candidate, targetSum);
        const candidateObjective = evaluatePrepared(prepared, candidate, sigmas, params, false).objective;
        if (candidateObjective >= current.objective + 1e-4 * stepSize * slope) {
          for (let i = 0; i < size; i += 1) theta[i] = candidate[i];
          accepted = true;
          break;
        }
        stepSize *= 0.5;
      }
      damping *= 10;
    }
    if (!accepted) break;
  }

  enforceAnchor(theta, targetSum);
  const finalState = evaluatePrepared(prepared, theta, sigmas, params, true);
  const finalMeanGradient = sum(finalState.gradient) / size;
  let projectedGradient = 0;
  for (const value of finalState.gradient) {
    projectedGradient = Math.max(projectedGradient, Math.abs(value - finalMeanGradient));
  }
  if (projectedGradient <= params.tolerance) converged = true;
  const covariance = conditionedCovariance(finalState.precision);
  return {
    theta,
    covariance,
    objective: finalState.objective,
    iterations,
    converged,
    projectedGradient
  };
}

function permutations(values) {
  if (values.length <= 1) return [values.slice()];
  const result = [];
  for (let i = 0; i < values.length; i += 1) {
    const rest = values.slice(0, i).concat(values.slice(i + 1));
    for (const suffix of permutations(rest)) result.push([values[i], ...suffix]);
  }
  return result;
}

function temperedOrderLogProbability(order, theta, scale, lambda) {
  const numerator = lambda * orderLogProbability(order, theta, scale);
  const normalizer = logSumExp(
    permutations(order).map((permutation) => lambda * orderLogProbability(permutation, theta, scale))
  );
  return numerator - normalizer;
}

function patternLogProbability(observation, theta, sigmas, params) {
  const scale = uncertaintyScale(observation.team1.concat(observation.team2), sigmas);
  const logStrength1 = scale * teamStrength(theta, observation.team1, params);
  const logStrength2 = scale * teamStrength(theta, observation.team2, params);
  let remaining1 = observation.team1.length;
  let remaining2 = observation.team2.length;
  let result = 0;
  for (const team of observation.teams) {
    if (remaining1 === 0 || remaining2 === 0) break;
    const logWeight1 = Math.log(remaining1) + logStrength1;
    const logWeight2 = Math.log(remaining2) + logStrength2;
    const denominator = logSumExp([logWeight1, logWeight2]);
    result += (team === 1 ? logWeight1 : logWeight2) - denominator;
    if (team === 1) remaining1 -= 1;
    else remaining2 -= 1;
  }
  return result;
}

function predictiveMetrics(prepared, theta, sigmas, params) {
  let patternLoss = 0;
  let patternWeight = 0;
  let withinLoss = 0;
  let withinWeight = 0;
  for (const observation of prepared.observations) {
    patternLoss -= observation.weight * patternLogProbability(observation, theta, sigmas, params);
    patternWeight += observation.weight;
    for (const team of [1, 2]) {
      const order = teamOrder(observation, team);
      const scale = uncertaintyScale(order, sigmas);
      withinLoss -= observation.weight
        * temperedOrderLogProbability(order, theta, scale, params.lambda);
      withinWeight += observation.weight;
    }
  }
  return {
    patternLogLoss: patternWeight > 0 ? patternLoss / patternWeight : null,
    temperedWithinLogLoss: withinWeight > 0 ? withinLoss / withinWeight : null,
    note: 'Use a genuinely held-out match set for tuning; never compare the combined MAP objective across lambda values.'
  };
}

function connectedComponents(adjacency) {
  const n = adjacency.length;
  const seen = new Set();
  const components = [];
  for (let start = 0; start < n; start += 1) {
    if (seen.has(start)) continue;
    const stack = [start];
    const members = [];
    seen.add(start);
    while (stack.length) {
      const node = stack.pop();
      members.push(node);
      for (let next = 0; next < n; next += 1) {
        if (adjacency[node][next] > EPS && !seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    components.push(members.sort((a, b) => a - b));
  }
  return components;
}

function buildDiagnostics(prepared, theta, sigmas, params, solve) {
  const n = prepared.handles.length;
  const adjacency = zeroMatrix(n);
  const effectiveByPlayer = Array(n).fill(0);
  const pairStats = new Map();
  const conditional = new Map();
  let doubleObserved = 0;
  let doubleExpected = 0;
  let patternWeight = 0;

  for (const observation of prepared.observations) {
    for (const index of observation.order) effectiveByPlayer[index] += observation.weight;
    for (const teamIndices of [observation.team1, observation.team2]) {
      for (let i = 0; i < teamIndices.length; i += 1) {
        for (let j = i + 1; j < teamIndices.length; j += 1) {
          const a = teamIndices[i];
          const b = teamIndices[j];
          adjacency[a][b] += observation.weight * params.lambda;
          adjacency[b][a] = adjacency[a][b];
          const key = a < b ? `${a}:${b}` : `${b}:${a}`;
          const first = a < b ? a : b;
          const second = a < b ? b : a;
          const order = teamOrder(observation, observation.team1.includes(a) ? 1 : 2);
          const firstAhead = order.indexOf(first) < order.indexOf(second) ? 1 : 0;
          const scale = uncertaintyScale([first, second], sigmas);
          const expected = 1 / (1 + Math.exp(-scale * (theta[first] - theta[second])));
          const current = pairStats.get(key) || { first, second, weight: 0, observed: 0, expected: 0 };
          current.weight += observation.weight;
          current.observed += observation.weight * firstAhead;
          current.expected += observation.weight * expected;
          pairStats.set(key, current);
        }
      }
    }
    const crossWeight = observation.weight / (observation.team1.length * observation.team2.length);
    for (const a of observation.team1) {
      for (const b of observation.team2) {
        adjacency[a][b] += crossWeight;
        adjacency[b][a] = adjacency[a][b];
      }
    }

    const scale = uncertaintyScale(observation.team1.concat(observation.team2), sigmas);
    const strength1 = scale * teamStrength(theta, observation.team1, params);
    const strength2 = scale * teamStrength(theta, observation.team2, params);
    const m = observation.team1.length;
    const firstLog1 = Math.log(m) + strength1;
    const firstLog2 = Math.log(m) + strength2;
    const pFirst1 = Math.exp(firstLog1 - logSumExp([firstLog1, firstLog2]));
    const secondLog11 = Math.log(m - 1) + strength1;
    const secondLog12 = Math.log(m) + strength2;
    const p11 = pFirst1 * Math.exp(secondLog11 - logSumExp([secondLog11, secondLog12]));
    const pFirst2 = 1 - pFirst1;
    const secondLog22 = Math.log(m - 1) + strength2;
    const secondLog21 = Math.log(m) + strength1;
    const p22 = pFirst2 * Math.exp(secondLog22 - logSumExp([secondLog22, secondLog21]));
    doubleObserved += observation.weight * (observation.teams[0] === observation.teams[1] ? 1 : 0);
    doubleExpected += observation.weight * (p11 + p22);
    patternWeight += observation.weight;

    const pattern = observation.teams.map((team) => (team === 1 ? 'A' : 'B')).join('');
    const current = conditional.get(pattern) || { pattern, weight: 0, withinNll: 0 };
    for (const team of [1, 2]) {
      const order = teamOrder(observation, team);
      current.withinNll -= observation.weight
        * temperedOrderLogProbability(order, theta, uncertaintyScale(order, sigmas), params.lambda);
    }
    current.weight += observation.weight;
    conditional.set(pattern, current);
  }

  const components = connectedComponents(adjacency).map((component) => (
    component.map((index) => prepared.handles[index])
  ));
  const pairResiduals = [...pairStats.values()]
    .filter((pair) => pair.weight >= params.pairMinWeight)
    .map((pair) => ({
      handles: [prepared.handles[pair.first], prepared.handles[pair.second]],
      effectiveWeight: pair.weight,
      observedFirstRate: pair.observed / pair.weight,
      predictedFirstRate: pair.expected / pair.weight,
      residual: (pair.observed - pair.expected) / pair.weight
    }))
    .sort((a, b) => b.effectiveWeight - a.effectiveWeight || a.handles[0].localeCompare(b.handles[0], 'en'))
    .slice(0, 20);

  return {
    handsUsed: prepared.observations.length,
    effectiveHands: sum(prepared.observations.map((observation) => observation.weight)),
    matchesUsed: prepared.matchesUsed,
    meanPrior: prepared.priors.length ? sum(prepared.priors.map((prior) => prior.mu0)) / prepared.priors.length : 0,
    anchorResidual: sum(theta) - sum(prepared.priors.map((prior) => prior.mu0)),
    components,
    componentCount: components.length,
    effectiveHandsByPlayer: Object.fromEntries(
      prepared.handles.map((handle, index) => [handle, effectiveByPlayer[index]])
    ),
    patternResidual: {
      observedDoubleRate: patternWeight > 0 ? doubleObserved / patternWeight : null,
      predictedDoubleRate: patternWeight > 0 ? doubleExpected / patternWeight : null,
      residual: patternWeight > 0 ? (doubleObserved - doubleExpected) / patternWeight : null
    },
    pairResiduals,
    conditionalOrder: [...conditional.values()]
      .map((entry) => ({
        pattern: entry.pattern,
        effectiveWeight: entry.weight,
        temperedWithinLogLoss: entry.weight > 0 ? entry.withinNll / (2 * entry.weight) : null
      }))
      .sort((a, b) => b.effectiveWeight - a.effectiveWeight || a.pattern.localeCompare(b.pattern, 'en')),
    iterations: solve.iterations,
    converged: solve.converged
  };
}

/**
 * Solve the complete history. `handMeta`, completion, winner and A-level fields are deliberately
 * ignored: every full hand is one observation and A-level completion is a deterministic consequence,
 * never an extra likelihood term.
 */
export function solveLatentRank({ matches = [], priors = {}, params: overrides = {}, warmStart } = {}) {
  const params = withParams(overrides);
  const prepared = prepareInput(matches, priors, params);
  let solve = solveMap(prepared, params, null, warmStart);
  if (!solve.converged) {
    throw new LatentRankSolveError(`initial MAP solve did not converge (residual=${solve.projectedGradient})`);
  }
  let sigmas = solve.covariance.map((row, index) => Math.sqrt(Math.max(0, row[index])));
  let likelihoodSigmas = null;

  // One outer uncertainty pass: turn posterior RD into a conservative Glicko-style
  // choice-set temperature, then re-solve. A single scalar per set keeps every likelihood
  // term shift-invariant, preserving the pool anchor and strict concavity.
  if (params.uncertaintyPasses === 1 && prepared.observations.length > 0) {
    likelihoodSigmas = sigmas;
    const warm = Object.fromEntries(prepared.handles.map((handle, index) => [handle, solve.theta[index]]));
    solve = solveMap(prepared, params, likelihoodSigmas, warm);
    if (!solve.converged) {
      throw new LatentRankSolveError(
        `uncertainty-pass MAP solve did not converge (residual=${solve.projectedGradient})`
      );
    }
    sigmas = solve.covariance.map((row, index) => Math.sqrt(Math.max(0, row[index])));
  }

  const players = {};
  for (let i = 0; i < prepared.handles.length; i += 1) {
    const handle = prepared.handles[i];
    players[handle] = {
      theta: solve.theta[i],
      sigma: sigmas[i],
      rating: Math.round(1000 + LATENT_RANK_SCALE * solve.theta[i]),
      mu0: prepared.priors[i].mu0,
      sigma0: prepared.priors[i].sigma0
    };
  }
  const diagnostics = buildDiagnostics(prepared, solve.theta, likelihoodSigmas, params, solve);
  return {
    algoVersion: LATENT_RANK_VERSION,
    params: {
      lambda: params.lambda,
      rho: params.rho,
      teamAgg: params.teamAgg,
      uncertaintyPasses: params.uncertaintyPasses
    },
    players,
    objective: solve.objective,
    fitMetrics: {
      ...predictiveMetrics(prepared, solve.theta, likelihoodSigmas, params),
      scope: 'in_sample_diagnostic_not_for_parameter_selection'
    },
    diagnostics
  };
}

/**
 * Score a separate evaluation set with a fitted model. Callers own the split:
 * teamAgg/structure uses patternLogLoss; lambda uses normalized temperedWithinLogLoss.
 */
export function scoreLatentRank({ matches = [], model, players, params: overrides = {} } = {}) {
  const fitted = players || model?.players || {};
  const params = withParams({ ...(model?.params || {}), ...overrides, uncertaintyPasses: 0 });
  const priors = Object.fromEntries(Object.entries(fitted).map(([handle, player]) => [handle, {
    mu0: finite(player?.theta),
    sigma0: positive(player?.sigma, params.newcomerSigma)
  }]));
  const prepared = prepareInput(matches, priors, params);
  const theta = prepared.handles.map((handle) => finite(fitted?.[handle]?.theta));
  const sigmas = prepared.handles.map((handle) => positive(fitted?.[handle]?.sigma, params.newcomerSigma));
  return {
    ...predictiveMetrics(prepared, theta, sigmas, params),
    scope: 'caller_supplied_evaluation_set'
  };
}

/** Objective/gradient/full precision at a caller-provided theta, for numerical tests. */
export function evaluateLatentRank({ matches = [], priors = {}, theta = {}, params: overrides = {} } = {}) {
  const params = withParams({ ...overrides, uncertaintyPasses: 0 });
  const prepared = prepareInput(matches, priors, params);
  const vector = prepared.handles.map((handle, index) => (
    Number.isFinite(Number(theta?.[handle])) ? Number(theta[handle]) : prepared.priors[index].mu0
  ));
  const state = evaluatePrepared(prepared, vector, null, params, true);
  return {
    handles: prepared.handles.slice(),
    objective: state.objective,
    gradient: Object.fromEntries(prepared.handles.map((handle, index) => [handle, state.gradient[index]])),
    precision: state.precision.map((row) => row.slice())
  };
}
