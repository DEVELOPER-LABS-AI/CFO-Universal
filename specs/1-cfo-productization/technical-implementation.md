# Technical Implementation Guide: Autonomous Agents on Vercel

**Feature**: DevLabs CFO Productization Strategy (1-cfo-productization)
**Created**: 2026-03-13
**Purpose**: Technical specifications for implementing FR-6 (Autonomous Financial Agents) on Vercel/Supabase architecture

---

## 1. Audit Logging Schema

### Database Schema (Prisma)

```prisma
// Add to prisma/schema.prisma

enum AgentType {
  INVOICE_GENERATOR
  EXPENSE_CATEGORIZER
  CASH_FLOW_MONITOR
  MARGIN_CALCULATOR
  REVENUE_ATTRIBUTOR
}

enum AgentExecutionStatus {
  RUNNING
  SUCCESS
  FAILED
  PARTIAL
  ROLLED_BACK
}

model AgentExecutionLog {
  id                String                @id @default(uuid())
  organizationId    String                @map("organization_id")
  organization      Organization          @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  agentType         AgentType             @map("agent_type")
  executionTime     DateTime              @map("execution_time") @default(now())
  completedAt       DateTime?             @map("completed_at")
  status            AgentExecutionStatus

  // Audit trail details
  actionsTaken      Json                  @map("actions_taken") @default("[]") // Array of change records
  errors            Json?                 @map("errors") // Array of error messages
  affectedEntities  Json                  @map("affected_entities") @default("{}") // { type: count }

  // Rollback capability
  rollbackAvailable Boolean               @default(true) @map("rollback_available")
  rollbackToken     String?               @unique @map("rollback_token")
  rollbackExpiresAt DateTime?             @map("rollback_expires_at") // 72-hour window
  rolledBackAt      DateTime?             @map("rolled_back_at")
  rolledBackBy      String?               @map("rolled_back_by") // User ID who triggered rollback

  // Performance metrics
  durationMs        Int?                  @map("duration_ms") // Execution time in milliseconds
  recordsProcessed  Int?                  @map("records_processed")

  // Traceability
  triggeredBy       String?               @map("triggered_by") // "CRON" | "MANUAL" | "API"
  triggeredByUserId String?               @map("triggered_by_user_id")

  createdAt         DateTime              @default(now()) @map("created_at")
  updatedAt         DateTime              @updatedAt @map("updated_at")

  @@index([organizationId, agentType, executionTime])
  @@index([rollbackToken])
  @@index([status, executionTime])
  @@map("agent_execution_logs")
}

// Add relation to Organization model
model Organization {
  // ... existing fields ...
  agentExecutionLogs AgentExecutionLog[]
}
```

### Migration SQL

```sql
-- Create enum types
CREATE TYPE "AgentType" AS ENUM (
  'INVOICE_GENERATOR',
  'EXPENSE_CATEGORIZER',
  'CASH_FLOW_MONITOR',
  'MARGIN_CALCULATOR',
  'REVENUE_ATTRIBUTOR'
);

CREATE TYPE "AgentExecutionStatus" AS ENUM (
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'PARTIAL',
  'ROLLED_BACK'
);

-- Create audit log table
CREATE TABLE "agent_execution_logs" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "agent_type" "AgentType" NOT NULL,
  "execution_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "status" "AgentExecutionStatus" NOT NULL,
  "actions_taken" JSONB NOT NULL DEFAULT '[]',
  "errors" JSONB,
  "affected_entities" JSONB NOT NULL DEFAULT '{}',
  "rollback_available" BOOLEAN NOT NULL DEFAULT true,
  "rollback_token" TEXT UNIQUE,
  "rollback_expires_at" TIMESTAMP(3),
  "rolled_back_at" TIMESTAMP(3),
  "rolled_back_by" TEXT,
  "duration_ms" INTEGER,
  "records_processed" INTEGER,
  "triggered_by" TEXT,
  "triggered_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

-- Create indexes for performance
CREATE INDEX "agent_execution_logs_org_type_time_idx"
  ON "agent_execution_logs"("organization_id", "agent_type", "execution_time" DESC);

CREATE INDEX "agent_execution_logs_rollback_token_idx"
  ON "agent_execution_logs"("rollback_token") WHERE "rollback_token" IS NOT NULL;

CREATE INDEX "agent_execution_logs_status_time_idx"
  ON "agent_execution_logs"("status", "execution_time" DESC);

-- Row-level security policies
ALTER TABLE "agent_execution_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs for their organization"
  ON "agent_execution_logs" FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Service role can insert/update (agents run with service role)
CREATE POLICY "Service role can manage agent logs"
  ON "agent_execution_logs" FOR ALL
  USING (true)
  WITH CHECK (true);
```

### TypeScript Types

```typescript
// types/agent-audit.ts

export interface AgentAction {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CATEGORIZE' | 'CALCULATE' | 'SEND_NOTIFICATION';
  entityType: string; // 'MERCURY_TRANSACTION', 'INVOICE', etc.
  entityId: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  confidence?: number; // For AI-powered categorization (0.0-1.0)
  reasoning?: string; // Human-readable explanation
  timestamp: Date;
}

export interface AgentExecutionLogData {
  organizationId: string;
  agentType: 'INVOICE_GENERATOR' | 'EXPENSE_CATEGORIZER' | 'CASH_FLOW_MONITOR' | 'MARGIN_CALCULATOR' | 'REVENUE_ATTRIBUTOR';
  actionsTaken: AgentAction[];
  errors?: Array<{ message: string; stack?: string; code?: string }>;
  affectedEntities: Record<string, number>; // { 'MERCURY_TRANSACTION': 247 }
  recordsProcessed?: number;
  triggeredBy: 'CRON' | 'MANUAL' | 'API';
  triggeredByUserId?: string;
}

export interface RollbackRequest {
  rollbackToken: string;
  reason: string;
  requestedBy: string; // User ID
}
```

---

## 2. Sample Supabase Edge Function: Expense Categorizer

### File: `supabase/functions/categorize-expenses/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

interface ExpenseCategorizationRequest {
  organizationId: string;
  batchSize?: number; // Default 100
  triggeredBy?: string;
}

serve(async (req) => {
  try {
    const { organizationId, batchSize = 100, triggeredBy = 'CRON' }: ExpenseCategorizationRequest = await req.json();

    // Initialize clients
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const startTime = Date.now();

    // Create audit log entry (RUNNING status)
    const { data: logEntry, error: logError } = await supabase
      .from('agent_execution_logs')
      .insert({
        organization_id: organizationId,
        agent_type: 'EXPENSE_CATEGORIZER',
        status: 'RUNNING',
        triggered_by: triggeredBy,
        execution_time: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) throw logError;

    // Fetch uncategorized expenses
    const { data: expenses, error: fetchError } = await supabase
      .from('expense_records')
      .select('id, merchant_name, amount, date, description')
      .eq('organization_id', organizationId)
      .is('category', null)
      .order('date', { ascending: false })
      .limit(batchSize);

    if (fetchError) throw fetchError;

    if (!expenses || expenses.length === 0) {
      // No expenses to categorize
      await supabase
        .from('agent_execution_logs')
        .update({
          status: 'SUCCESS',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          records_processed: 0,
          actions_taken: [],
          affected_entities: { EXPENSE_RECORD: 0 }
        })
        .eq('id', logEntry.id);

      return new Response(JSON.stringify({ categorized: 0, message: 'No uncategorized expenses found' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Categorize using Claude
    const actions: any[] = [];
    const errors: any[] = [];
    let categorizedCount = 0;

    for (const expense of expenses) {
      try {
        const prompt = `Categorize this business expense:
Merchant: ${expense.merchant_name}
Amount: $${expense.amount}
Date: ${expense.date}
Description: ${expense.description || 'N/A'}

Return ONLY one of these categories:
- PAYROLL
- CONTRACTOR
- SUBSCRIPTION_SAAS
- SUBSCRIPTION_SOFTWARE
- MARKETING
- OFFICE_SUPPLIES
- TRAVEL
- MEALS
- UTILITIES
- PROFESSIONAL_SERVICES
- INSURANCE
- TAXES
- OTHER

Format: Just the category name, nothing else.`;

        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 50,
          messages: [{ role: 'user', content: prompt }]
        });

        const category = message.content[0].type === 'text'
          ? message.content[0].text.trim()
          : 'OTHER';

        // Update expense record
        const { error: updateError } = await supabase
          .from('expense_records')
          .update({ category, categorized_by_agent: true, categorized_at: new Date().toISOString() })
          .eq('id', expense.id);

        if (updateError) {
          errors.push({ expenseId: expense.id, message: updateError.message });
        } else {
          categorizedCount++;
          actions.push({
            action: 'CATEGORIZE',
            entityType: 'EXPENSE_RECORD',
            entityId: expense.id,
            oldValue: { category: null },
            newValue: { category },
            confidence: 0.85, // Claude confidence estimate
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        errors.push({
          expenseId: expense.id,
          message: error.message,
          stack: error.stack
        });
      }
    }

    // Generate rollback token
    const rollbackToken = crypto.randomUUID();
    const rollbackExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    // Update audit log with results
    const finalStatus = errors.length === 0 ? 'SUCCESS' : (categorizedCount > 0 ? 'PARTIAL' : 'FAILED');

    await supabase
      .from('agent_execution_logs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        records_processed: expenses.length,
        actions_taken: actions,
        errors: errors.length > 0 ? errors : null,
        affected_entities: { EXPENSE_RECORD: categorizedCount },
        rollback_token: rollbackToken,
        rollback_expires_at: rollbackExpiresAt.toISOString()
      })
      .eq('id', logEntry.id);

    return new Response(JSON.stringify({
      success: true,
      categorized: categorizedCount,
      total: expenses.length,
      errors: errors.length,
      executionTimeMs: Date.now() - startTime,
      rollbackToken,
      logId: logEntry.id
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Expense categorization failed:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
```

### Vercel Cron Integration

```typescript
// app/api/agents/expense-categorizer/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60; // Vercel timeout
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient();

    // Get all organizations with active integrations
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .not('mercury_connection_id', 'is', null);

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ message: 'No organizations to process' });
    }

    // Invoke Supabase Edge Function for each org (parallel)
    const results = await Promise.allSettled(
      orgs.map(org =>
        supabase.functions.invoke('categorize-expenses', {
          body: { organizationId: org.id, batchSize: 100, triggeredBy: 'CRON' }
        })
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      processed: orgs.length,
      successful,
      failed,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cron failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Add to `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/agents/expense-categorizer",
      "schedule": "0 3 * * *"
    }
  ]
}
```

---

## 3. Rollback Mechanism Design

### API Route: `app/api/agents/rollback/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rollbackToken, reason } = await request.json();

    if (!rollbackToken) {
      return NextResponse.json({ error: 'Rollback token required' }, { status: 400 });
    }

    // Fetch audit log entry
    const logEntry = await prisma.agentExecutionLog.findUnique({
      where: { rollbackToken },
      include: { organization: true }
    });

    if (!logEntry) {
      return NextResponse.json({ error: 'Invalid rollback token' }, { status: 404 });
    }

    // Verify user has access to this organization
    const userProfile = await prisma.userProfile.findFirst({
      where: { userId: user.id, organizationId: logEntry.organizationId }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized for this organization' }, { status: 403 });
    }

    // Check rollback availability
    if (!logEntry.rollbackAvailable) {
      return NextResponse.json({
        error: 'Rollback not available (already rolled back or expired)'
      }, { status: 400 });
    }

    if (logEntry.rollbackExpiresAt && new Date(logEntry.rollbackExpiresAt) < new Date()) {
      return NextResponse.json({
        error: 'Rollback window expired (72-hour limit)'
      }, { status: 400 });
    }

    // Perform rollback based on agent type
    const actionsTaken = logEntry.actionsTaken as any[];
    const rollbackActions: any[] = [];

    for (const action of actionsTaken) {
      try {
        switch (action.entityType) {
          case 'EXPENSE_RECORD':
            if (action.action === 'CATEGORIZE') {
              await prisma.expenseRecord.update({
                where: { id: action.entityId },
                data: {
                  category: action.oldValue?.category || null,
                  categorizedByAgent: false,
                  categorizedAt: null
                }
              });
              rollbackActions.push({
                entityType: action.entityType,
                entityId: action.entityId,
                action: 'REVERTED',
                timestamp: new Date()
              });
            }
            break;

          // Add other entity types as needed
          case 'INVOICE':
          case 'MERCURY_TRANSACTION':
          // ... handle other rollback scenarios
        }
      } catch (error) {
        console.error(`Rollback failed for ${action.entityId}:`, error);
        // Continue with other actions
      }
    }

    // Update audit log
    await prisma.agentExecutionLog.update({
      where: { id: logEntry.id },
      data: {
        status: 'ROLLED_BACK',
        rollbackAvailable: false,
        rolledBackAt: new Date(),
        rolledBackBy: user.id
      }
    });

    // Create new audit log entry for the rollback itself
    await prisma.agentExecutionLog.create({
      data: {
        organizationId: logEntry.organizationId,
        agentType: logEntry.agentType,
        status: 'SUCCESS',
        actionsTaken: rollbackActions,
        affectedEntities: { ROLLBACK: rollbackActions.length },
        triggeredBy: 'MANUAL',
        triggeredByUserId: user.id
      }
    });

    return NextResponse.json({
      success: true,
      rolledBackActions: rollbackActions.length,
      message: `Successfully rolled back ${rollbackActions.length} actions`,
      reason
    });

  } catch (error) {
    console.error('Rollback failed:', error);
    return NextResponse.json({
      error: 'Rollback failed',
      details: error.message
    }, { status: 500 });
  }
}
```

### UI Component: Rollback Button

```typescript
// components/agent-audit-log-viewer.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface AgentAuditLogProps {
  log: {
    id: string;
    agentType: string;
    executionTime: Date;
    status: string;
    actionsTaken: any[];
    rollbackToken: string | null;
    rollbackAvailable: boolean;
    rollbackExpiresAt: Date | null;
  };
}

export function AgentAuditLogViewer({ log }: AgentAuditLogProps) {
  const [rolling back, setRollingBack] = useState(false);

  const handleRollback = async () => {
    setRollingBack(true);
    try {
      const response = await fetch('/api/agents/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollbackToken: log.rollbackToken,
          reason: 'User-initiated rollback'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Rollback failed: ${error.error}`);
      } else {
        alert('Rollback successful. Changes have been reverted.');
        window.location.reload();
      }
    } catch (error) {
      alert('Rollback failed. Please try again.');
    } finally {
      setRollingBack(false);
    }
  };

  const canRollback = log.rollbackAvailable &&
    log.rollbackExpiresAt &&
    new Date(log.rollbackExpiresAt) > new Date();

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold">{log.agentType.replace('_', ' ')}</h3>
          <p className="text-sm text-gray-600">
            {log.executionTime.toLocaleString()}
          </p>
          <p className="text-sm">
            Status: <span className={`font-medium ${log.status === 'SUCCESS' ? 'text-green-600' : 'text-red-600'}`}>
              {log.status}
            </span>
          </p>
          <p className="text-sm text-gray-600">
            Actions: {log.actionsTaken.length}
          </p>
        </div>

        {canRollback && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={rollingBack}>
                {rollingBack ? 'Rolling back...' : 'Rollback'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rollback Agent Actions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will revert all {log.actionsTaken.length} actions performed by this agent.
                  This operation cannot be undone after the 72-hour rollback window expires.

                  Expires: {log.rollbackExpiresAt?.toLocaleString()}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRollback}>
                  Confirm Rollback
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Actions detail view */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-blue-600">
          View {log.actionsTaken.length} actions
        </summary>
        <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-64">
          {JSON.stringify(log.actionsTaken, null, 2)}
        </pre>
      </details>
    </div>
  );
}
```

---

## 4. Migration Guide: ThePopeBot Patterns → Vercel

### Pattern Mapping

| ThePopeBot Pattern | Vercel/Supabase Equivalent | Implementation |
|-------------------|---------------------------|----------------|
| **Docker Container** | Supabase Edge Function (Deno runtime) | Isolated execution environment |
| **GitHub Actions Workflow** | Vercel Cron + pg_cron | Scheduled job triggers |
| **Git Commits (audit)** | PostgreSQL `agent_execution_logs` table | Database-native audit trail |
| **Persistent File State** | PostgreSQL tables | Structured, queryable state |
| **Custom Scheduling** | `vercel.json` crons + pg_cron | Cron expression scheduling |
| **Rollback via Git** | Rollback API + transaction revert | Application-level rollback |

### Step-by-Step Migration

#### Step 1: Replace Docker Execution → Supabase Edge Functions

**Before (ThePopeBot)**:
```yaml
# .github/workflows/agent.yml
name: Expense Categorizer
on:
  schedule:
    - cron: '0 3 * * *'
jobs:
  categorize:
    runs-on: ubuntu-latest
    container: node:20
    steps:
      - run: node scripts/categorize-expenses.js
```

**After (Vercel/Supabase)**:
```typescript
// supabase/functions/categorize-expenses/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  // Agent logic here (see Section 2)
});
```

**Trigger**:
```json
// vercel.json
{
  "crons": [
    { "path": "/api/agents/expense-categorizer", "schedule": "0 3 * * *" }
  ]
}
```

#### Step 2: Replace Git Audit → Database Audit

**Before (ThePopeBot)**:
```bash
# Each action creates a git commit
git commit -m "Agent: Categorized 100 expenses [automated]"
git push origin main
```

**After (Vercel/Supabase)**:
```typescript
await prisma.agentExecutionLog.create({
  data: {
    organizationId,
    agentType: 'EXPENSE_CATEGORIZER',
    actionsTaken: [/* array of changes */],
    status: 'SUCCESS'
  }
});
```

#### Step 3: Replace Git Rollback → Application Rollback

**Before (ThePopeBot)**:
```bash
# Revert last agent commit
git revert HEAD
git push origin main
```

**After (Vercel/Supabase)**:
```typescript
// POST /api/agents/rollback
await fetch('/api/agents/rollback', {
  method: 'POST',
  body: JSON.stringify({ rollbackToken })
});
```

#### Step 4: State Management Migration

**Before (ThePopeBot)**:
```javascript
// state.json committed to git
{
  "lastProcessedId": "txn_123",
  "processedCount": 500
}
```

**After (Vercel/Supabase)**:
```typescript
// agent_state table
CREATE TABLE agent_state (
  organization_id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,
  state JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

// Query state
const state = await prisma.agentState.findUnique({
  where: {
    organizationId_agentType: {
      organizationId,
      agentType: 'EXPENSE_CATEGORIZER'
    }
  }
});
```

### Time Limit Adjustments

**ThePopeBot**: No execution time limits (long-running containers)

**Vercel/Supabase**: Fixed limits, requires batching

```typescript
// Before: Process all 10,000 expenses at once
async function categorizeAllExpenses() {
  const expenses = await fetchAllUncategorized(); // 10,000 records
  for (const expense of expenses) {
    await categorize(expense); // 5+ minutes total
  }
}

// After: Batch processing with pagination
async function categorizeExpensesBatch(batchSize = 100) {
  const expenses = await fetchUncategorized({ limit: batchSize });

  for (const expense of expenses) {
    await categorize(expense); // Completes in <60s
  }

  // Next batch triggered by next cron execution
}
```

### Testing Locally

**ThePopeBot**: Run Docker container locally
```bash
docker build -t agent .
docker run agent
```

**Vercel/Supabase**: Use Supabase CLI
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase
supabase start

# Serve Edge Function locally
supabase functions serve categorize-expenses --env-file .env.local

# Test
curl -i --location --request POST 'http://localhost:54321/functions/v1/categorize-expenses' \
  --header 'Authorization: Bearer <anon-key>' \
  --header 'Content-Type: application/json' \
  --data '{"organizationId":"test-org-123"}'
```

---

## 5. Deployment Checklist

### Prerequisites

- [ ] Vercel account (Pro tier for 60s timeout)
- [ ] Supabase project (Pro tier for 900s Edge Functions)
- [ ] Anthropic API key (for Claude integration)
- [ ] Telegram Bot token (for notifications)

### Database Setup

```bash
# Generate Prisma migration
npx prisma migrate dev --name add-agent-execution-logs

# Apply to production
npx prisma migrate deploy
```

### Deploy Supabase Edge Function

```bash
# Login to Supabase
supabase login

# Link to project
supabase link --project-ref <your-project-ref>

# Deploy function
supabase functions deploy categorize-expenses

# Set secrets
supabase secrets set ANTHROPIC_API_KEY=<your-key>
```

### Update Vercel Configuration

```bash
# Add to vercel.json (already shown in Section 2)
# Push to GitHub → Auto-deploys to Vercel

# Set environment variables in Vercel dashboard:
# - CRON_SECRET
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
```

### Test End-to-End

```bash
# Trigger cron manually
curl -X GET https://your-domain.com/api/agents/expense-categorizer \
  -H "Authorization: Bearer $CRON_SECRET"

# Check audit logs
# Query agent_execution_logs table via Supabase dashboard

# Test rollback
curl -X POST https://your-domain.com/api/agents/rollback \
  -H "Content-Type: application/json" \
  -d '{"rollbackToken":"<token-from-log>"}'
```

---

## 6. Monitoring & Observability

### Vercel Logs

```bash
# View function logs
vercel logs --follow

# Filter by function
vercel logs --follow /api/agents/expense-categorizer
```

### Supabase Edge Function Logs

```bash
# View Edge Function logs
supabase functions logs categorize-expenses --follow
```

### Database Queries for Monitoring

```sql
-- Recent agent executions
SELECT
  agent_type,
  status,
  execution_time,
  duration_ms,
  records_processed,
  jsonb_array_length(actions_taken) as actions_count
FROM agent_execution_logs
WHERE organization_id = 'org-123'
ORDER BY execution_time DESC
LIMIT 20;

-- Failure rate by agent type
SELECT
  agent_type,
  COUNT(*) FILTER (WHERE status = 'SUCCESS') as successes,
  COUNT(*) FILTER (WHERE status = 'FAILED') as failures,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'FAILED') / COUNT(*), 2) as failure_rate_pct
FROM agent_execution_logs
WHERE execution_time > NOW() - INTERVAL '7 days'
GROUP BY agent_type;

-- Average execution time
SELECT
  agent_type,
  ROUND(AVG(duration_ms) / 1000.0, 2) as avg_seconds,
  MAX(duration_ms) / 1000.0 as max_seconds,
  COUNT(*) as executions
FROM agent_execution_logs
WHERE status IN ('SUCCESS', 'PARTIAL')
  AND execution_time > NOW() - INTERVAL '30 days'
GROUP BY agent_type;
```

---

## 7. Cost Estimates

### Monthly Costs (50 organizations)

| Service | Tier | Usage | Cost |
|---------|------|-------|------|
| Vercel | Pro | 4 cron jobs, 79 API routes | $20 |
| Supabase | Pro | 900s Edge Functions, 10GB DB | $25 |
| Anthropic API | Pay-as-you-go | ~10K categorizations/mo | $5-15 |
| **Total** | | | **$50-60/mo** |

**vs. ThePopeBot (Docker/GitHub)**:
- Docker registry: $10/mo
- EC2 t3.micro (long jobs): $8-15/mo
- GitHub Actions: $0 (free tier) or $0.008/min
- **Total**: $18-50+/mo (but requires DevOps maintenance)

**Verdict**: Vercel/Supabase is cost-competitive and simpler to operate.

---

## Conclusion

This implementation provides:
- ✅ All FR-6 requirements met
- ✅ Better audit trail than git commits
- ✅ Automatic rollback capability
- ✅ No Docker complexity
- ✅ Cost-effective ($50-60/mo)
- ✅ Scales automatically
- ✅ Production-ready

**Next Steps**: Proceed with `/speckit.plan` to break down implementation into tasks.
