---
theme: default
title: Test Presentation
---

# Test Presentation

Testing diagram extraction and regeneration

---

# Simple Flowchart

Basic three-node flowchart for testing.

```mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
```

---

# Device Plugins Turn GPUs Into Schedulable Resources

This slide has a longer title to test slug generation.

```mermaid
flowchart LR
    GPU[GPU Hardware] --> DP[Device Plugin]
    DP --> K8s[Kubelet]
    K8s --> Sched[Scheduler]
```

---

# Sequence Diagram

Testing sequence diagram conversion.

```mermaid
sequenceDiagram
    participant Client
    participant Server
    Client->>Server: Request
    Server-->>Client: Response
```
