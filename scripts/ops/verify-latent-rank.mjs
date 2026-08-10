/** LADDER-3 executable contract for shared/latentRank.js. */
import assert from 'node:assert/strict';
import {
  LATENT_RANK_SCALE,
  LatentRankInputError,
  LatentRankSolveError,
  effectiveHands,
  evaluateLatentRank,
  marginalHandWeight,
  priorFromLegacy,
  scoreLatentRank,
  solveLatentRank
} from '../../shared/latentRank.js';

const ROSTER = [
  { handle: 'alice', team: 1 },
  { handle: 'bob', team: 1 },
  { handle: 'carol', team: 2 },
  { handle: 'dave', team: 2 }
];

const PRIORS = {
  alice: { mu0: 0.1, sigma0: 0.5, hasLegacy: true },
  bob: { mu0: -0.05, sigma0: 0.9 },
  carol: { mu0: 0.02, sigma0: 0.5, hasLegacy: true },
  dave: { mu0: -0.07, sigma0: 0.9 }
};

function match(id, hands, extra = {}) {
  return { _id: id, mode: 4, roster: ROSTER, hands, ...extra };
}

function permutations(values) {
  if (values.length < 2) return [values.slice()];
  const result = [];
  for (let i = 0; i < values.length; i += 1) {
    const rest = values.slice(0, i).concat(values.slice(i + 1));
    for (const suffix of permutations(rest)) result.push([values[i], ...suffix]);
  }
  return result;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffled(values, random) {
  const copy = values.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const history = [
  match('m-01', [[0, 2, 1, 3], [2, 0, 3, 1], [0, 1, 2, 3]]),
  match('m-02', [[1, 3, 0, 2], [3, 1, 2, 0]]),
  match('m-03', [[0, 2, 3, 1], [2, 1, 0, 3], [1, 0, 3, 2], [3, 0, 2, 1]]),
  match('m-04', [[2, 0, 1, 3]]),
  match('m-05', [[0, 3, 1, 2], [1, 2, 0, 3]])
];

// Fixed marginal weights: monotone, bounded, never retroactively renormalized.
assert.equal(effectiveHands(1), 1);
assert.ok(Math.abs(effectiveHands(3) - (3 / 1.4)) < 1e-12);
assert.ok(Math.abs(effectiveHands(16) - 4) < 1e-12);
assert.ok(marginalHandWeight(2) > marginalHandWeight(3));
assert.ok(marginalHandWeight(16) > 0);

// Legacy prior uses one beat-rate channel and distinct legacy/newcomer widths.
const legacyPrior = priorFromLegacy({ legacyBeatRate: 0.7, games: 20 });
assert.ok(Math.abs(legacyPrior.mu0 - 0.4) < 1e-12);
assert.equal(legacyPrior.sigma0, 0.5);
assert.equal(legacyPrior.hasLegacy, true);
assert.equal(legacyPrior.games, 20);
assert.equal(priorFromLegacy({}).sigma0, 0.9);

// Strict concavity: -H (precision) is positive in every tested direction.
const evaluation = evaluateLatentRank({ matches: history, priors: PRIORS });
for (let seed = 1; seed <= 20; seed += 1) {
  const random = seededRandom(seed);
  const direction = evaluation.handles.map(() => random() * 2 - 1);
  let quadratic = 0;
  for (let i = 0; i < direction.length; i += 1) {
    for (let j = 0; j < direction.length; j += 1) {
      quadratic += direction[i] * evaluation.precision[i][j] * direction[j];
    }
  }
  assert.ok(quadratic > 0, `precision must be positive definite (seed ${seed})`);
}

// Analytic gradient and full Hessian agree with central finite differences.
const probeTheta = { alice: 0.17, bob: -0.21, carol: 0.08, dave: -0.03 };
const analytic = evaluateLatentRank({ matches: history, priors: PRIORS, theta: probeTheta });
const finiteStep = 1e-5;
for (let column = 0; column < analytic.handles.length; column += 1) {
  const handle = analytic.handles[column];
  const plusTheta = { ...probeTheta, [handle]: probeTheta[handle] + finiteStep };
  const minusTheta = { ...probeTheta, [handle]: probeTheta[handle] - finiteStep };
  const plus = evaluateLatentRank({ matches: history, priors: PRIORS, theta: plusTheta });
  const minus = evaluateLatentRank({ matches: history, priors: PRIORS, theta: minusTheta });
  const numericGradient = (plus.objective - minus.objective) / (2 * finiteStep);
  assert.ok(
    Math.abs(numericGradient - analytic.gradient[handle]) < 1e-6,
    `${handle} analytic gradient must match finite differences`
  );
  for (let row = 0; row < analytic.handles.length; row += 1) {
    const rowHandle = analytic.handles[row];
    const numericHessian = (plus.gradient[rowHandle] - minus.gradient[rowHandle]) / (2 * finiteStep);
    assert.ok(
      Math.abs(numericHessian + analytic.precision[row][column]) < 1e-6,
      `${rowHandle}/${handle} analytic Hessian must match finite differences`
    );
  }
}

// Unique constrained MAP: extreme warm starts converge to the same point.
const cold = solveLatentRank({ matches: history, priors: PRIORS, params: { uncertaintyPasses: 0 } });
const hot = solveLatentRank({
  matches: history,
  priors: PRIORS,
  params: { uncertaintyPasses: 0 },
  warmStart: { alice: 5, bob: -4, carol: 3, dave: -2 }
});
for (const handle of Object.keys(cold.players)) {
  assert.ok(
    Math.abs(cold.players[handle].theta - hot.players[handle].theta) < 1e-7,
    `${handle} should converge to the unique MAP from either start`
  );
}
const coldGradient = evaluateLatentRank({
  matches: history,
  priors: PRIORS,
  theta: Object.fromEntries(Object.entries(cold.players).map(([handle, player]) => [handle, player.theta]))
}).gradient;
assert.ok(
  Math.max(...Object.values(coldGradient)) - Math.min(...Object.values(coldGradient)) < 1e-6,
  'constrained optimum must have zero projected gradient'
);

// 20 arrival orders are byte-for-byte identical after canonical match sorting.
const canonicalRatings = Object.values(solveLatentRank({ matches: history, priors: PRIORS }).players)
  .map((player) => player.rating);
for (let seed = 1; seed <= 20; seed += 1) {
  const reordered = shuffled(history, seededRandom(seed * 101));
  const ratings = Object.values(solveLatentRank({ matches: reordered, priors: PRIORS }).players)
    .map((player) => player.rating);
  assert.deepEqual(ratings, canonicalRatings, `arrival order ${seed} must not change any display rating`);
}

// Explicit pool anchor, including mixed prior widths: sum(theta) == sum(mu0).
const anchored = solveLatentRank({ matches: history, priors: PRIORS });
const thetaSum = Object.values(anchored.players).reduce((total, player) => total + player.theta, 0);
const priorSum = Object.values(anchored.players).reduce((total, player) => total + player.mu0, 0);
assert.ok(Math.abs(thetaSum - priorSum) < 1e-12, `anchor residual ${thetaSum - priorSum}`);
assert.ok(Math.abs(anchored.diagnostics.anchorResidual) < 1e-12);

// Laplace sigma uses the full correlated Hessian inverse, not 1/sqrt(diagonal).
const coldAtMap = evaluateLatentRank({
  matches: history,
  priors: PRIORS,
  theta: Object.fromEntries(Object.entries(cold.players).map(([handle, player]) => [handle, player.theta]))
});
const naiveSigma = 1 / Math.sqrt(coldAtMap.precision[0][0]);
assert.ok(
  Math.abs(cold.players[coldAtMap.handles[0]].sigma - naiveSigma) > 1e-3,
  'fixed-partner correlation must make full-Hessian sigma differ from diagonal approximation'
);

// A-level completion/winner metadata is display-only and contributes exactly zero likelihood.
const aFields = history.map((item) => ({
  ...item,
  completed: true,
  winnerKey: 't1',
  handMeta: item.hands.map(() => ({ round: 'A', t1: 'A', t2: 'K', winKey: 't1', up: 3 }))
}));
assert.deepEqual(
  solveLatentRank({ matches: aFields, priors: PRIORS }).players,
  solveLatentRank({ matches: history, priors: PRIORS }).players,
  'A-level fields must not enter the likelihood'
);

// Six dominant newcomer matches must produce a visible >= +120 climb.
const newcomerRoster = [
  { handle: 'newbie', team: 1 },
  { handle: 'ally', team: 1 },
  { handle: 'opp1', team: 2 },
  { handle: 'opp2', team: 2 }
];
const newcomerMatches = Array.from({ length: 6 }, (_, index) => ({
  _id: `new-${index}`,
  mode: 4,
  roster: newcomerRoster,
  hands: [[0, 1, 2, 3]]
}));
const newcomer = solveLatentRank({
  matches: newcomerMatches,
  priors: {
    newbie: { mu0: 0, sigma0: 0.9 },
    ally: { mu0: 0, sigma0: 0.5 },
    opp1: { mu0: 0, sigma0: 0.5 },
    opp2: { mu0: 0, sigma0: 0.5 }
  }
});
assert.ok(
  newcomer.players.newbie.rating >= 1120,
  `six dominant matches should climb >= +120, got ${newcomer.players.newbie.rating - 1000}`
);

// Bounded stopping-time attack: after a balanced history, stop as soon as the
// target's cumulative score gradient turns positive. Mean display displacement
// over 1000 fair simulations must stay inside a 2-point Monte Carlo envelope.
const balancedPriors = Object.fromEntries(
  ['alice', 'bob', 'carol', 'dave'].map((handle) => [handle, { mu0: 0, sigma0: 0.9 }])
);
const balancedHistory = permutations([0, 1, 2, 3]).map((handOrder, index) => (
  match(`balanced-${String(index).padStart(2, '0')}`, [handOrder])
));
const balancedBase = solveLatentRank({ matches: balancedHistory, priors: balancedPriors });
assert.equal(balancedBase.players.alice.rating, 1000);
let displacementTotal = 0;
for (let trial = 0; trial < 1000; trial += 1) {
  const random = seededRandom(123456 + trial * 97);
  const hands = [];
  for (let handNumber = 1; handNumber <= 16; handNumber += 1) {
    hands.push(shuffled([0, 1, 2, 3], random));
    const gradient = evaluateLatentRank({
      matches: [match(`attack-${trial}`, hands)],
      priors: balancedPriors,
      theta: { alice: 0, bob: 0, carol: 0, dave: 0 }
    }).gradient.alice;
    if (gradient > 1e-12) break;
  }
  const attacked = solveLatentRank({
    matches: balancedHistory.concat(match(`attack-${trial}`, hands)),
    priors: balancedPriors
  });
  displacementTotal += attacked.players.alice.rating - balancedBase.players.alice.rating;
}
const meanStoppingDisplacement = displacementTotal / 1000;
assert.ok(
  Math.abs(meanStoppingDisplacement) < 2,
  `stopping strategy mean displacement must be <2, got ${meanStoppingDisplacement}`
);

// Any incomplete/unbalanced roster is rejected instead of silently estimating a partial graph.
assert.throws(
  () => solveLatentRank({
    matches: [{
      _id: 'partial',
      mode: 4,
      roster: ROSTER.slice(0, 3),
      hands: [[0, 1, 2]]
    }]
  }),
  (error) => error instanceof LatentRankInputError && error.code === 'incomplete_roster'
);
assert.throws(
  () => solveLatentRank({
    matches: history,
    priors: PRIORS,
    params: { maxIterations: 1, tolerance: 1e-15 },
    warmStart: { alice: 9, bob: -8, carol: 7, dave: -6 }
  }),
  (error) => error instanceof LatentRankSolveError && error.code === 'solver_not_converged',
  'partial Newton output must fail closed instead of masquerading as a rating state'
);

// Diagnostics/heldout contracts needed by the real-data offline report.
assert.equal(anchored.diagnostics.componentCount, 1);
assert.ok(anchored.diagnostics.handsUsed > 0);
assert.ok(anchored.diagnostics.pairResiduals.length > 0);
assert.ok(anchored.diagnostics.conditionalOrder.length > 0);
assert.equal(anchored.fitMetrics.scope, 'in_sample_diagnostic_not_for_parameter_selection');
const heldout = scoreLatentRank({ matches: history.slice(0, 2), model: anchored });
assert.ok(Number.isFinite(heldout.patternLogLoss));
assert.ok(Number.isFinite(heldout.temperedWithinLogLoss));
assert.equal(heldout.scope, 'caller_supplied_evaluation_set');
assert.ok(Math.abs(LATENT_RANK_SCALE - 173.71779276130073) < 1e-12);

console.log('latent rank two-level PL checks passed');
