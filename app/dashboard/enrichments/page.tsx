import Link from 'next/link';
import { getEnrichmentSubscriptions } from '@/app/actions/subscription-management';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, ArrowRight } from 'lucide-react';

export default async function EnrichmentsPage() {
  const { subscriptions, stats } = await getEnrichmentSubscriptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Enrichments</h1>
        <p className="text-muted-foreground mt-1">
          All enrichment-tagged subscriptions and their costs
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Enrichment Spend</p>
            <p className="text-2xl font-bold">${stats.totalSpend.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Credits</p>
            <p className="text-2xl font-bold">{stats.totalCredits.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Enrichment Subscriptions</p>
            <p className="text-2xl font-bold">{stats.totalSubscriptions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.activeCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Enrichment Subscriptions Table */}
      {subscriptions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No enrichment subscriptions</p>
            <p className="text-sm mt-1">
              Tag a subscription as enrichment in its settings to see it here
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Enrichment Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {subscriptions.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/dashboard/subscriptions/${sub.id}`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{sub.name}</span>
                      <Badge variant={sub.is_active ? 'default' : 'secondary'} className="text-xs">
                        {sub.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {sub.billing_frequency}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {sub.total_credits && (
                        <span>{sub.total_credits.toLocaleString()} credits</span>
                      )}
                      {sub.credit_cost_email !== null && (
                        <span>{sub.credit_cost_email} credits/email</span>
                      )}
                      {sub.credit_cost_phone !== null && (
                        <span>{sub.credit_cost_phone} credits/phone</span>
                      )}
                      {sub.allocated_clients.length > 0 && (
                        <span>
                          {sub.allocated_clients.length} client{sub.allocated_clients.length !== 1 ? 's' : ''} allocated
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">${sub.effective_cost.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {sub.effective_cost !== sub.total_cost ? 'effective' : 'configured'}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Client Enrichment Cost Breakdown */}
      {subscriptions.some((s) => s.allocated_clients.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Client Enrichment Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(() => {
                // Aggregate enrichment costs per client across all subscriptions
                const clientCosts = new Map<string, { name: string; total: number; subs: string[] }>();
                for (const sub of subscriptions) {
                  for (const client of sub.allocated_clients) {
                    if (!client.id || !client.name) continue;
                    const existing = clientCosts.get(client.id) || { name: client.name, total: 0, subs: [] };
                    existing.total += client.cost_allocated;
                    existing.subs.push(sub.name);
                    clientCosts.set(client.id, existing);
                  }
                }

                const sorted = Array.from(clientCosts.entries())
                  .sort((a, b) => b[1].total - a[1].total);

                if (sorted.length === 0) return null;

                return sorted.map(([clientId, data]) => (
                  <div
                    key={clientId}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <Link
                        href={`/dashboard/clients/${clientId}`}
                        className="font-medium text-sm hover:underline"
                      >
                        {data.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {data.subs.join(', ')}
                      </p>
                    </div>
                    <p className="font-semibold">${data.total.toFixed(2)}</p>
                  </div>
                ));
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
