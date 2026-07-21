# Priya Kapoor

Auckland, NZ · priya.kapoor@example.com · github.com/priyakapoor-ds

## Education

**MSc Computer Science — University of Auckland** (2020–2022)
Thesis: "Consensus Under Churn: Reconfiguration in Large-Scale Distributed Key-Value Stores." GPA 8.5/9.0.

## Experience

**Senior Software Engineer — OrbitDB (Series B, distributed database startup)** (2023–present)
Core storage team (6 engineers). OrbitDB is a geo-distributed key-value store with ~200 production clusters.
- Designed the shard-rebalancing protocol that reduced rebalance downtime from minutes to sub-second: replaced a stop-the-world coordinator with a gossip-based ownership handoff. The protocol uses vector clocks for conflict resolution during split-brain and a two-phase handoff to ensure no writes are lost during transition.
- Led migration from Kafka 3.x to Redpanda for the cluster metadata bus: benchmarked both against our workload (high-partition-count, sub-ms p99 target) and chose Redpanda for its thread-per-core model that eliminated the consumer-group rebalance pauses we were hitting at 1K+ partitions. Wrote the migration tooling; zero-downtime rollout across 200 clusters.
- Owned the on-call escalation path for 18 months; wrote postmortems for 3 major incidents. One led to rewriting the hinted-handoff subsystem after discovering correlated node failures during a regional AWS outage caused cascading data loss.

**Backend Engineer — ZeptoPay (fintech, Auckland)** (2021–2023)
Payments platform processing ~50K tx/min.
- Built the transaction-idempotency service: a Redis-backed deduplication layer that guaranteed exactly-once processing across payment retries. Handled the edge case where a retry arrives before the original completes (used a state machine with 3 states per idempotency key: PENDING/COMMITTED/ABORTED, and a TTL-based reaper for abandoned keys).
- Profiled and reduced p99 latency of the payment-confirmation endpoint from 1.2s to 350ms: moved a synchronous fraud-check call to async with a 50ms deadline, replaced a blocking external HTTP call with gRPC streaming, and added a write-behind cache for the config service.

## Projects

**ShardLab** (2024, solo)
A simulator for testing distributed consensus protocols under various failure models. Written in Rust; supports crash-fault, Byzantine, and network-partition scenarios. Used by 2 university research groups.

## Skills

Rust, Go, Java, Kafka/Redpanda, PostgreSQL, Redis, gRPC, Docker, K8s, Terraform, AWS, Prometheus/Grafana, Jepsen (basic)

## Talks

- "Gossip Without the Drama: Rebalancing at OrbitDB" — DevOpsDays Auckland 2024
- Guest lecture: Distributed Systems, University of Auckland (2024, 2025)
