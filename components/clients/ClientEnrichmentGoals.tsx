'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { updateClientEnrichmentGoals } from '@/app/actions/client-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';
import { Mail, Phone, AlertTriangle, Check } from 'lucide-react';

interface EnrichmentBudget {
  totalCredits: number;
  avgEmailCost: number;
  avgPhoneCost: number;
  enrichmentSubCount: number;
  allocatedClientCount: number;
}

interface ClientEnrichmentGoalsProps {
  clientId: string;
  clientName: string;
  currentEmailsPerMonth: number | null;
  currentPhonesPerMonth: number | null;
  enrichmentBudget: EnrichmentBudget;
}

export function ClientEnrichmentGoals({
  clientId,
  clientName,
  currentEmailsPerMonth,
  currentPhonesPerMonth,
  enrichmentBudget,
}: ClientEnrichmentGoalsProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [emailGoal, setEmailGoal] = useState<string>(currentEmailsPerMonth?.toString() ?? '');
  const [phoneGoal, setPhoneGoal] = useState<string>(currentPhonesPerMonth?.toString() ?? '');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const emailChanged = (emailGoal || null) !== (currentEmailsPerMonth?.toString() ?? null);
    const phoneChanged = (phoneGoal || null) !== (currentPhonesPerMonth?.toString() ?? null);
    setIsDirty(emailChanged || phoneChanged);
  }, [emailGoal, phoneGoal, currentEmailsPerMonth, currentPhonesPerMonth]);

  const { totalCredits, avgEmailCost, avgPhoneCost, allocatedClientCount } = enrichmentBudget;

  // Calculate recommended even split across allocated clients
  const clientCount = Math.max(allocatedClientCount, 1);
  const creditsPerClient = totalCredits / clientCount;
  const recommendedEmails = avgEmailCost > 0 ? Math.floor(creditsPerClient / avgEmailCost) : 0;
  const recommendedPhones = avgPhoneCost > 0 ? Math.floor(creditsPerClient / avgPhoneCost) : 0;

  // Calculate credits needed for this client's goals
  const parsedEmails = parseInt(emailGoal) || 0;
  const parsedPhones = parseInt(phoneGoal) || 0;
  const creditsNeeded = (parsedEmails * avgEmailCost) + (parsedPhones * avgPhoneCost);
  const creditSurplus = creditsPerClient - creditsNeeded;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateClientEnrichmentGoals(clientId, {
        enrichment_emails_per_month: emailGoal ? parseInt(emailGoal) : null,
        enrichment_phones_per_month: phoneGoal ? parseInt(phoneGoal) : null,
      });
      toast.success(`Enrichment goals updated for ${clientName}`);
      setIsDirty(false);
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to update enrichment goals');
    } finally {
      setIsSaving(false);
    }
  };

  if (enrichmentBudget.enrichmentSubCount === 0) {
    return null; // Don't show if no enrichment subscriptions exist
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Enrichment Goals</CardTitle>
          <CardDescription>
            Monthly enrichment targets for this client
          </CardDescription>
        </div>
        {isDirty && (
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Goals'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Budget overview */}
        <div className="grid grid-cols-3 gap-3 p-3 border rounded-lg bg-muted/30 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Org Total Credits</p>
            <p className="font-semibold">{totalCredits.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Credits / Client (even split)</p>
            <p className="font-semibold">{Math.floor(creditsPerClient).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Clients on enrichment</p>
            <p className="font-semibold">{allocatedClientCount}</p>
          </div>
        </div>

        {/* Goal inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email-goal" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Emails / Month
            </Label>
            <Input
              id="email-goal"
              type="number"
              min="0"
              value={emailGoal}
              onChange={(e) => setEmailGoal(e.target.value)}
              placeholder={recommendedEmails > 0 ? `Recommended: ${recommendedEmails.toLocaleString()}` : '0'}
            />
            {recommendedEmails > 0 && !emailGoal && (
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setEmailGoal(recommendedEmails.toString())}
              >
                Use recommended ({recommendedEmails.toLocaleString()})
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone-goal" className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> Phones / Month
            </Label>
            <Input
              id="phone-goal"
              type="number"
              min="0"
              value={phoneGoal}
              onChange={(e) => setPhoneGoal(e.target.value)}
              placeholder={recommendedPhones > 0 ? `Recommended: ${recommendedPhones.toLocaleString()}` : '0'}
            />
            {recommendedPhones > 0 && !phoneGoal && (
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setPhoneGoal(recommendedPhones.toString())}
              >
                Use recommended ({recommendedPhones.toLocaleString()})
              </button>
            )}
          </div>
        </div>

        {/* Credit budget analysis */}
        {(parsedEmails > 0 || parsedPhones > 0) && avgEmailCost > 0 && (
          <div className={`p-3 border rounded-lg ${creditSurplus >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {creditSurplus >= 0 ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-sm font-medium ${creditSurplus >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {creditSurplus >= 0 ? 'Within budget' : 'Over budget'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Credits needed:</span>{' '}
                <span className="font-medium">{Math.ceil(creditsNeeded).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Budget per client:</span>{' '}
                <span className="font-medium">{Math.floor(creditsPerClient).toLocaleString()}</span>
              </div>
              {creditSurplus < 0 && (
                <div className="col-span-2">
                  <Badge variant="destructive" className="text-xs">
                    Need {Math.ceil(Math.abs(creditSurplus)).toLocaleString()} more credits
                  </Badge>
                </div>
              )}
              {creditSurplus >= 0 && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Remaining:</span>{' '}
                  <span className="font-medium text-green-600">
                    {Math.floor(creditSurplus).toLocaleString()} credits
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
