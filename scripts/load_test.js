import grpc from 'k6/net/grpc';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const client = new grpc.Client();
client.load(['../proto'], 'tixo.proto');

const bookingAttempts = new Counter('booking_attempts');
const bookingSuccesses = new Counter('booking_successes');
const bookingRejections = new Counter('booking_rejections');
const grpcRpcFailures = new Counter('grpc_rpc_failures');
const bookingLatency = new Trend('booking_latency', true);
const bookingTimestamp = new Trend('booking_timestamp');

const scenarioMetrics = {
  baseline: {
    attempts: new Counter('baseline_attempts'),
    successes: new Counter('baseline_successes'),
    rejections: new Counter('baseline_rejections'),
    rpcFailures: new Counter('baseline_rpc_failures'),
    latency: new Trend('baseline_booking_latency', true),
  },
  'ticket-war-5': {
    attempts: new Counter('ticket_war_5_attempts'),
    successes: new Counter('ticket_war_5_successes'),
    rejections: new Counter('ticket_war_5_rejections'),
    rpcFailures: new Counter('ticket_war_5_rpc_failures'),
    latency: new Trend('ticket_war_5_booking_latency', true),
  },
  'ticket-war-20': {
    attempts: new Counter('ticket_war_20_attempts'),
    successes: new Counter('ticket_war_20_successes'),
    rejections: new Counter('ticket_war_20_rejections'),
    rpcFailures: new Counter('ticket_war_20_rpc_failures'),
    latency: new Trend('ticket_war_20_booking_latency', true),
  },
};

export const options = {
  scenarios: {
    baseline: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '30s',
      exec: 'baseline',
    },
    ticket_war_5: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 1,
      startTime: '2s',
      maxDuration: '30s',
      exec: 'ticketWar5',
    },
    ticket_war_20: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 1,
      startTime: '4s',
      maxDuration: '30s',
      exec: 'ticketWar20',
    },
  },
  thresholds: {
    checks: ['rate > 0.99'],
  },
};

function bookSeat(scheduleId, seatNumber, scenarioName) {
  client.connect(__ENV.GRPC_SERVER_ADDRESS || 'localhost:50051', { plaintext: true });

  const transactionId = `load-${scenarioName}-${Date.now()}-${__VU}-${__ITER}`;
  const startedAt = Date.now();
  const response = client.invoke('tixo.TixoService/PesanKursi', {
    schedule_id: scheduleId,
    seat_number: seatNumber,
    user_id: `load-user-${scenarioName}-${__VU}`,
    user_email: `load-${scenarioName}-${__VU}@example.test`,
    transaction_id: transactionId,
  });
  const latency = Date.now() - startedAt;
  const metrics = scenarioMetrics[scenarioName];
  bookingLatency.add(latency);
  bookingTimestamp.add(startedAt);
  metrics.latency.add(latency);
  bookingAttempts.add(1, { scenario: scenarioName });
  metrics.attempts.add(1);

  const rpcSucceeded = response && response.status === grpc.StatusOK;
  const bookingSucceeded = rpcSucceeded && response.message && response.message.success === true;
  if (bookingSucceeded) {
    bookingSuccesses.add(1, { scenario: scenarioName });
    metrics.successes.add(1);
  } else if (rpcSucceeded) {
    bookingRejections.add(1, { scenario: scenarioName });
    metrics.rejections.add(1);
  } else {
    grpcRpcFailures.add(1, { scenario: scenarioName });
    metrics.rpcFailures.add(1);
  }

  check(response, {
    'gRPC request completed': (result) => result && result.status === grpc.StatusOK,
    'booking result is explicit': (result) => result && result.message && typeof result.message.success === 'boolean',
  });
  client.close();
  sleep(0.1);
}

export function baseline() {
  bookSeat(__ENV.BASELINE_SCHEDULE_ID || 'sch-01', __ENV.BASELINE_SEAT || 'A1', 'baseline');
}

export function ticketWar5() {
  bookSeat(__ENV.WAR5_SCHEDULE_ID || 'sch-01', __ENV.WAR5_SEAT || 'A2', 'ticket-war-5');
}

export function ticketWar20() {
  bookSeat(__ENV.WAR20_SCHEDULE_ID || 'sch-01', __ENV.WAR20_SEAT || 'A3', 'ticket-war-20');
}

export function handleSummary(data) {
  const metricCount = (name) => data.metrics[name]?.values.count || 0;
  const metricAverage = (name) => data.metrics[name]?.values.avg || 0;
  const attempts = data.metrics.booking_attempts?.values.count || 0;
  const successes = data.metrics.booking_successes?.values.count || 0;
  const rejections = data.metrics.booking_rejections?.values.count || 0;
  const rpcFailures = data.metrics.grpc_rpc_failures?.values.count || 0;
  const averageLatency = data.metrics.booking_latency?.values.avg || 0;
  const firstRequestAt = data.metrics.booking_timestamp?.values.min || 0;
  const lastRequestAt = data.metrics.booking_timestamp?.values.max || 0;
  const measuredWindowMs = Math.max(
    lastRequestAt - firstRequestAt + averageLatency,
    averageLatency
  );
  const stateDurationMs = Number(data.state?.testRunDuration || 0);
  const testDurationMs = stateDurationMs > 0 ? stateDurationMs : measuredWindowMs;
  const testDurationSeconds = testDurationMs / 1000;
  const throughput = testDurationSeconds > 0 ? attempts / testDurationSeconds : 0;
  const applicationRejectionRate = attempts > 0 ? (rejections / attempts) * 100 : 0;
  const grpcErrorRate = attempts > 0 ? (rpcFailures / attempts) * 100 : 0;

  const scenarios = [
    ['Baseline (1 VU)', 'baseline'],
    ['Ticket war (5 VU)', 'ticket_war_5'],
    ['Ticket war (20 VU)', 'ticket_war_20'],
  ];
  const scenarioSummary = scenarios.map(([label, prefix]) => {
    const scenarioAttempts = metricCount(`${prefix}_attempts`);
    const scenarioSuccesses = metricCount(`${prefix}_successes`);
    const scenarioRejections = metricCount(`${prefix}_rejections`);
    const scenarioRpcFailures = metricCount(`${prefix}_rpc_failures`);
    const scenarioAverageLatency = metricAverage(`${prefix}_booking_latency`);
    const scenarioRejectionRate = scenarioAttempts > 0
      ? ((scenarioRejections / scenarioAttempts) * 100).toFixed(2)
      : '0.00';
    const scenarioErrorRate = scenarioAttempts > 0
      ? ((scenarioRpcFailures / scenarioAttempts) * 100).toFixed(2)
      : '0.00';

    return `${label}: attempts=${scenarioAttempts}, successes=${scenarioSuccesses}, rejections=${scenarioRejections}, latency=${scenarioAverageLatency.toFixed(2)} ms, rejection_rate=${scenarioRejectionRate}%, grpc_error_rate=${scenarioErrorRate}%`;
  }).join('\n');

  return {
    stdout: `\nTIXO load test summary\n========================\nOverall attempts: ${attempts}\nOverall successes: ${successes}\nOverall rejections: ${rejections}\nAverage booking latency: ${averageLatency.toFixed(2)} ms\nThroughput: ${throughput.toFixed(2)} attempts/s\nApplication rejection rate: ${applicationRejectionRate.toFixed(2)}%\ngRPC error rate: ${grpcErrorRate.toFixed(2)}%\n\nPer-scenario summary\n--------------------\n${scenarioSummary}\n`,
  };
}
