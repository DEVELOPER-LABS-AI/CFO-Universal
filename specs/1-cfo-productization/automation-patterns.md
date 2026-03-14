# Automation Patterns for Autonomous Financial Agents

**Feature**: 1-cfo-productization
**Created**: 2026-03-13
**Source**: [6 Patterns for Bulletproof Automation](https://futurebrief.ai/p/6-patterns-for-a-bullet-proof-automation)
**Purpose**: Apply proven automation patterns to FR-6 (Autonomous Financial Agents)

---

## Pattern Application Matrix

| Pattern | CFO Agent Use Case | Implementation | Benefit |
|---------|-------------------|----------------|---------|
| **1. Trigger-Route** | Cash flow monitoring alerts | Vercel Cron → Check balance → Send alert if threshold crossed | Ensures critical alerts never silently fail |
| **2. Filter-Fan** | Expense categorization | Uncategorized expense → AI categorization → Route to category buckets + "unclassified" fallback | Prevents expenses from disappearing into void |
| **3. Collector** | Monthly revenue aggregation | Collect from Mercury + Xero + Contracts → Validate counts → Generate report | Detects incomplete data before financial close |
| **4. Loop** | Invoice generation retries | Generate invoice → Send → Retry if failed (max 3 attempts) → Alert after exhaustion | Prevents infinite retry loops |
| **5. Transformer** | Revenue attribution | Raw bank deposits → AI matching → Structured client attribution | Consistent data for margin calculations |
| **6. Watcher** | Margin degradation detection | Monitor client margins daily → Alert on 3-month decline trend | Catches slow profitability erosion |

---

## 1. Trigger-Route Pattern: Cash Flow Monitoring

### Implementation

```typescript
// Pattern: Single trigger → Linear path → One outcome + failure alert

// Vercel Cron: Daily at 9 AM
export async function GET() {
  try {
    // Step 1: Trigger (scheduled)
    const orgs = await getOrgsWithCashFlowMonitoring();

    for (const org of orgs) {
      // Step 2: Route (linear path)
      const balance = await getMercuryBalance(org.id);
      const threshold = await getCashFlowThreshold(org.id);

      // Step 3: Outcome
      if (balance < threshold) {
        await sendTelegramAlert(org.ownerId, {
          type: 'CASH_FLOW_LOW',
          balance,
          threshold,
          message: `Cash flow alert: Balance $${balance.toFixed(2)}K. Threshold: $${threshold}K.`
        });

        // Log successful alert
        await logAgentAction({
          agentType: 'CASH_FLOW_MONITOR',
          status: 'SUCCESS',
          actionsTaken: [{ action: 'ALERT_SENT', balance, threshold }]
        });
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    // **KEY: Failure alert at last step**
    await sendSlackAlert('devops-channel', {
      error: 'Cash flow monitoring failed',
      details: error.message,
      timestamp: new Date()
    });

    throw error;
  }
}
```

**Benefit**: Guarantees notification even if agent execution fails—prevents silent cash flow crises.

---

## 2. Filter-Fan Pattern: Expense Categorization

### Implementation

```typescript
// Pattern: One input → Multiple conditional exits + unclassified catch-all

interface CategoryRoute {
  condition: (expense: Expense) => boolean;
  category: ExpenseCategory;
}

const CATEGORY_ROUTES: CategoryRoute[] = [
  { condition: e => e.merchantName.includes('AWS'), category: 'SUBSCRIPTION_SAAS' },
  { condition: e => e.merchantName.includes('Stripe'), category: 'SUBSCRIPTION_SOFTWARE' },
  { condition: e => e.amount > 5000 && e.description.includes('payroll'), category: 'PAYROLL' },
  // ... more routing rules
];

async function categorizeExpense(expense: Expense) {
  // Try deterministic routes first
  for (const route of CATEGORY_ROUTES) {
    if (route.condition(expense)) {
      return { category: route.category, confidence: 0.99, method: 'RULE_BASED' };
    }
  }

  // Fallback to AI categorization
  try {
    const aiCategory = await categorizeWithClaude(expense);
    return { category: aiCategory, confidence: 0.85, method: 'AI' };
  } catch (error) {
    // **KEY: Unclassified catch-all branch**
    await alertHuman({
      type: 'UNCATEGORIZED_EXPENSE',
      expenseId: expense.id,
      merchantName: expense.merchantName,
      amount: expense.amount,
      reason: error.message
    });

    return { category: 'UNCLASSIFIED', confidence: 0.0, method: 'MANUAL_REVIEW_NEEDED' };
  }
}
```

**Benefit**: 60% of automation builds use this pattern. Prevents expenses from being silently ignored when categorization fails.

---

## 3. Collector Pattern: Monthly Financial Close

### Implementation

```typescript
// Pattern: Multiple streams → Aggregate → Validate counts → Output

async function generateMonthlyReport(orgId: string, month: string, year: number) {
  const startTime = Date.now();

  // Collect from multiple sources
  const [mercuryRevenue, xeroRevenue, contractRevenue] = await Promise.all([
    fetchMercuryRevenue(orgId, month, year),
    fetchXeroRevenue(orgId, month, year),
    fetchContractRevenue(orgId, month, year)
  ]);

  // **KEY: Validate record counts before proceeding**
  const expectedSources = 3;
  const receivedSources = [mercuryRevenue, xeroRevenue, contractRevenue].filter(Boolean).length;

  if (receivedSources < expectedSources) {
    await logWarning({
      type: 'INCOMPLETE_DATA_COLLECTION',
      expected: expectedSources,
      received: receivedSources,
      missing: ['mercuryRevenue', 'xeroRevenue', 'contractRevenue']
        .filter((_, i) => ![mercuryRevenue, xeroRevenue, contractRevenue][i])
    });

    throw new Error('Cannot generate report with incomplete data');
  }

  // Aggregate totals
  const totalRevenue = [mercuryRevenue, xeroRevenue, contractRevenue]
    .reduce((sum, source) => sum + (source?.total || 0), 0);

  // Detect anomalies (e.g., Mercury >> Xero suggests missing invoices)
  if (Math.abs(mercuryRevenue.total - xeroRevenue.total) > xeroRevenue.total * 0.10) {
    await alertFinanceTeam({
      type: 'REVENUE_DISCREPANCY',
      mercuryTotal: mercuryRevenue.total,
      xeroTotal: xeroRevenue.total,
      variance: mercuryRevenue.total - xeroRevenue.total,
      threshold: '10%'
    });
  }

  // Output unified report
  return generateReport({ totalRevenue, sources: { mercuryRevenue, xeroRevenue, contractRevenue } });
}
```

**Benefit**: Detects incomplete data before financial reports are generated, preventing incorrect margin calculations.

---

## 4. Loop Pattern: Invoice Generation with Retry

### Implementation

```typescript
// Pattern: Repeat until condition met + hard exit after N attempts

async function generateMonthlyInvoices(orgId: string) {
  const clients = await getClientsWithActiveContracts(orgId);
  const results = { success: 0, failed: 0, retried: 0 };

  for (const client of clients) {
    let attempts = 0;
    const MAX_ATTEMPTS = 3; // **KEY: Hard exit condition**
    let invoiceGenerated = false;

    while (!invoiceGenerated && attempts < MAX_ATTEMPTS) {
      attempts++;

      try {
        const invoice = await generateInvoice(client);
        await sendInvoiceEmail(client.email, invoice);

        invoiceGenerated = true;
        results.success++;
      } catch (error) {
        console.error(`Invoice generation failed for ${client.id} (attempt ${attempts}):`, error);

        if (attempts < MAX_ATTEMPTS) {
          results.retried++;
          await sleep(Math.pow(2, attempts) * 1000); // Exponential backoff
        } else {
          // **KEY: Exit after max attempts, alert human**
          results.failed++;
          await alertAccountingTeam({
            type: 'INVOICE_GENERATION_FAILED',
            clientId: client.id,
            clientName: client.name,
            attempts: MAX_ATTEMPTS,
            lastError: error.message
          });
        }
      }
    }
  }

  return results;
}
```

**Benefit**: Prevents infinite loops consuming resources. Ensures human intervention after reasonable retry attempts.

---

## 5. Transformer Pattern: Revenue Attribution (AI Sandwich)

### Implementation

```typescript
// Pattern: Clean input → Single-purpose AI task → Structured output

interface BankDeposit {
  id: string;
  amount: number;
  merchantName: string;
  date: Date;
  description?: string;
}

interface AttributedRevenue {
  depositId: string;
  clientId: string | null;
  confidence: number;
  reasoning: string;
}

async function attributeRevenueToClient(
  deposit: BankDeposit,
  clients: Client[]
): Promise<AttributedRevenue> {

  // **Step 1: Structure clean input (AI Sandwich top bun)**
  const prompt = `Match this bank deposit to one of the clients below:

Deposit Details:
- Merchant: ${deposit.merchantName}
- Amount: $${deposit.amount}
- Date: ${deposit.date.toISOString().split('T')[0]}
- Description: ${deposit.description || 'N/A'}

Clients:
${clients.map(c => `- ID: ${c.id}, Name: ${c.name}, Active Services: ${c.services.join(', ')}`).join('\n')}

Return ONLY a JSON object with:
{ "clientId": "<id or null>", "confidence": 0.0-1.0, "reasoning": "<explanation>" }`;

  // **Step 2: Execute single task (AI call)**
  const response = await claudeAPI.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  });

  // **Step 3: Parse structured output (AI Sandwich bottom bun)**
  const result = JSON.parse(response.content[0].text);

  // Validate schema
  if (!result.clientId || typeof result.confidence !== 'number') {
    throw new Error('Invalid AI response schema');
  }

  return {
    depositId: deposit.id,
    clientId: result.clientId,
    confidence: result.confidence,
    reasoning: result.reasoning
  };
}
```

**Benefit**: Treats AI as typed function with defined input/output contracts. Prevents hallucinations from polluting downstream systems.

---

## 6. Watcher Pattern: Margin Degradation Detection

### Implementation

```typescript
// Pattern: Passive monitoring → Fire only on threshold/anomaly

interface WatcherConfig {
  metric: string;
  threshold: number;
  evaluationFrequency: string; // cron expression
  cooldownPeriod: number; // minutes between alerts
}

const MARGIN_WATCHER: WatcherConfig = {
  metric: 'client_margin_percent',
  threshold: -10, // Alert if margin drops 10+ points
  evaluationFrequency: '0 6 * * *', // Daily at 6 AM
  cooldownPeriod: 1440 // 24 hours (don't spam same alert)
};

async function watchClientMargins() {
  const orgs = await getAllOrgs();

  for (const org of orgs) {
    const clients = await getClients(org.id);

    for (const client of clients) {
      // Calculate 90-day margin trend
      const currentMargin = await getClientMargin(client.id, 'current_month');
      const historicalMargin = await getClientMargin(client.id, '90_days_ago');

      const marginDelta = currentMargin - historicalMargin;

      // **KEY: Fire only on threshold crossing**
      if (marginDelta <= MARGIN_WATCHER.threshold) {
        // Check cooldown (avoid alert spam)
        const lastAlert = await getLastAlert(org.id, 'MARGIN_DEGRADATION', client.id);
        if (lastAlert && Date.now() - lastAlert.sentAt < MARGIN_WATCHER.cooldownPeriod * 60 * 1000) {
          continue; // Skip (cooldown active)
        }

        // **KEY: Include triggering data in alert**
        await sendAlert(org.ownerId, {
          type: 'MARGIN_DEGRADATION',
          clientId: client.id,
          clientName: client.name,
          currentMargin,
          historicalMargin,
          delta: marginDelta,
          severity: marginDelta < -20 ? 'CRITICAL' : 'WARNING',
          actionable: `Review pricing for ${client.name}. Margin dropped from ${historicalMargin}% to ${currentMargin}%.`
        });

        // Log alert sent
        await logAlert(org.id, 'MARGIN_DEGRADATION', client.id);
      }
    }
  }
}
```

**Benefit**: Invisible during normal operations. Only fires when actionable thresholds crossed, with cooldowns preventing alert fatigue.

---

## Applied Patterns by Agent Type

### Expense Categorizer Agent

**Primary Pattern**: **Filter-Fan** (60% of automation builds use this)
```
Uncategorized Expense
    ↓
Rule-Based Routes (AWS→SUBSCRIPTION, Stripe→SOFTWARE)
    ↓ (if no match)
AI Categorization
    ↓ (if AI fails)
UNCLASSIFIED catch-all → Human alert
```

**Secondary Pattern**: **Transformer** (AI Sandwich)
- Clean input: Expense details formatted for Claude
- Single task: Categorize into predefined categories
- Structured output: Category + confidence score

**Implementation**:
```typescript
// Combine Filter-Fan + Transformer
const category =
  tryRuleBasedRouting(expense) ||     // Filter-Fan
  await aiCategorization(expense) ||   // Transformer
  'UNCLASSIFIED';                      // Catch-all

if (category === 'UNCLASSIFIED') {
  await alertAccountant(expense); // Prevents silent drops
}
```

---

### Cash Flow Monitor Agent

**Primary Pattern**: **Watcher**
```
Passive monitoring (daily check)
    ↓
Balance < Threshold?
    ↓ (yes)
Fire alert with context
    ↓
Cooldown 24 hours
```

**Key Implementation Details**:
- Frequency: Daily at 9 AM (users have full day to respond)
- Threshold: Configurable (default: 2 weeks operating expenses)
- Cooldown: 24 hours (prevents spam if balance stays low)
- Context included: Current balance, threshold, projected shortfall date

---

### Invoice Generator Agent

**Primary Pattern**: **Loop** (with hard exits)
```
For each client with active contract:
    ↓
Generate invoice (attempt 1)
    ↓ (if failed)
Retry with backoff (attempt 2)
    ↓ (if failed)
Final retry (attempt 3)
    ↓ (if still failed)
Exit loop → Alert accounting team
```

**Secondary Pattern**: **Trigger-Route** (with failure alert)
- Monthly trigger (1st of month)
- Linear path: Generate → Send → Log
- Failure alert at final step if ANY invoices fail

**Implementation**:
```typescript
const MAX_RETRIES = 3;
let failedInvoices = [];

for (const client of clients) {
  let success = false;

  for (let attempt = 0; attempt < MAX_RETRIES && !success; attempt++) {
    try {
      await generateAndSendInvoice(client);
      success = true;
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) {
        failedInvoices.push({ client, error });
      } else {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
}

// Failure alert at last step
if (failedInvoices.length > 0) {
  await alertAccountingTeam({
    type: 'INVOICE_GENERATION_FAILURES',
    failedCount: failedInvoices.length,
    details: failedInvoices
  });
}
```

---

### Revenue Attributor Agent

**Primary Pattern**: **Transformer** (AI Sandwich)
```
Raw Bank Deposits (Mercury)
    ↓ (clean input)
Structured prompt with client list
    ↓ (single AI task)
Claude matches deposit → client
    ↓ (parse structured output)
JSON { clientId, confidence, reasoning }
    ↓
Store attribution in database
```

**Secondary Pattern**: **Collector**
- Collect deposits from Mercury
- Collect invoices from Xero
- Collect contracts from internal DB
- **Validate counts** before attribution (catch missing data)

**Implementation**:
```typescript
async function attributeRevenue(orgId: string, month: string) {
  // Collector: Gather from 3 sources
  const [deposits, invoices, contracts] = await Promise.all([
    fetchMercuryDeposits(orgId, month),
    fetchXeroInvoices(orgId, month),
    fetchActiveContracts(orgId, month)
  ]);

  // Validate completeness
  if (!deposits || !invoices) {
    throw new Error('Incomplete revenue data - cannot attribute');
  }

  // Transformer: Clean input
  const clients = await getActiveClients(orgId);
  const attributions = [];

  for (const deposit of deposits) {
    // AI Sandwich: Structured I/O
    const attribution = await attributeRevenueToClient(deposit, clients);
    attributions.push(attribution);
  }

  return attributions;
}
```

---

### Margin Calculator Agent

**Primary Pattern**: **Collector** + **Watcher**
```
Collector Phase:
  ├── Revenue from Mercury
  ├── Costs from Xero
  ├── Contractor costs from internal DB
  └── Overhead from subscriptions
    ↓
Calculate margin
    ↓
Watcher Phase:
  Compare to target margin
    ↓ (if delta > 10 points)
  Fire alert
```

**Implementation**:
```typescript
async function calculateAndWatchMargins() {
  const clients = await getAllClients();

  for (const client of clients) {
    // Collector: Aggregate costs from multiple sources
    const [revenue, laborCosts, contractorCosts, overhead] = await Promise.all([
      getClientRevenue(client.id),
      getClientLaborCosts(client.id),
      getClientContractorCosts(client.id),
      getClientOverheadAllocation(client.id)
    ]);

    const totalCosts = laborCosts + contractorCosts + overhead;
    const margin = ((revenue - totalCosts) / revenue) * 100;

    // Watcher: Threshold monitoring
    const targetMargin = client.customMarginTarget || 25;
    const delta = margin - targetMargin;

    if (delta < -10) { // 10+ points below target
      await sendAlert({
        type: 'MARGIN_GAP',
        client: client.name,
        currentMargin: margin,
        targetMargin: targetMargin,
        gap: Math.abs(delta),
        severity: delta < -20 ? 'CRITICAL' : 'WARNING'
      });
    }
  }
}
```

---

## Design Principles from Patterns

### 1. Always Include Failure Alerts (Trigger-Route)
```typescript
try {
  await executeAgentLogic();
} catch (error) {
  // Never fail silently
  await sendDevOpsAlert('Agent execution failed', error);
  throw error;
}
```

### 2. Build Catch-All Branches (Filter-Fan)
```typescript
const category =
  ruleBasedMatch(expense) ||
  aiCategorization(expense) ||
  'UNCLASSIFIED'; // Catch-all prevents data loss
```

### 3. Validate Completeness Before Aggregation (Collector)
```typescript
const sources = await Promise.allSettled([...]);
const failed = sources.filter(s => s.status === 'rejected');
if (failed.length > 0) {
  throw new Error('Cannot proceed with incomplete data');
}
```

### 4. Define Hard Exit Conditions (Loop)
```typescript
for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
  // Explicit exit after 3 attempts
}
```

### 5. Use AI Sandwich for Consistent I/O (Transformer)
```typescript
const structuredInput = formatPrompt(data);
const aiOutput = await claudeAPI.call(structuredInput);
const parsedOutput = validateAndParse(aiOutput); // Schema validation
```

### 6. Include Cooldowns in Watchers
```typescript
if (threshold crossed && !inCooldown) {
  await sendAlert(context); // Include triggering data
  await setCooldown(24 hours);
}
```

---

## Implementation Checklist

For each autonomous agent, ensure:

- [ ] **Trigger-Route**: Failure alert implemented at final step
- [ ] **Filter-Fan**: Unclassified catch-all branch exists if using routing logic
- [ ] **Collector**: Source count validation before aggregation
- [ ] **Loop**: Hard exit condition defined (max retries, timeout)
- [ ] **Transformer**: AI prompts use structured I/O with schema validation
- [ ] **Watcher**: Cooldown period configured to prevent alert spam
- [ ] **Audit Trail**: All patterns log to `agent_execution_logs` table
- [ ] **Rollback**: Actions are reversible within 72-hour window

---

## Pattern Selection Guide

| Agent Characteristic | Recommended Pattern | Example |
|---------------------|---------------------|---------|
| Single notification path | Trigger-Route | Cash flow alerts |
| Multiple conditional outcomes | Filter-Fan | Expense categorization |
| Aggregating multiple sources | Collector | Monthly financial reports |
| Retries with escalation | Loop | Invoice generation |
| AI-powered transformation | Transformer | Revenue attribution |
| Continuous threshold monitoring | Watcher | Margin degradation detection |

---

## Conclusion

These 6 patterns provide bulletproof automation design for FR-6 requirements:
- ✅ Transparent audit trails (all patterns log execution)
- ✅ Error capture without blocking (catch-all branches, failure alerts)
- ✅ Rollback capability (actions structured for reversal)
- ✅ Notifications (alerts at key decision points)
- ✅ Reliability (hard exits, validation, cooldowns)

**Next Step**: Apply these patterns during implementation of autonomous agents in Phase 2 (Q3 2026).
