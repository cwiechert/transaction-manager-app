import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Loader2 } from "lucide-react";

interface Transaction {
  Id: string;
  payment_reason: string;
  amount: number;
  currency: string;
  transaction_timestamp_local: string;
  category: string | null;
  description: string | null;
  transaction_type: string | null;
  transferation_type: string | null;
}

export const TransactionCategorizer = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUncategorizedTransactions();
  }, []);

  const fetchUncategorizedTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('Id, payment_reason, amount, currency, transaction_timestamp_local, category, description, transaction_type, transferation_type')
        .is('category', null)
        .order('transaction_timestamp_local', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTransaction = async (
    transactionId: string,
    category: string,
    description: string,
    applyToAll: boolean,
    paymentReason: string
  ) => {
    setUpdating(transactionId);
    
    try {
      if (applyToAll) {
        // First, create/update the categorization rule
        const { error: ruleError } = await supabase
          .from('categorization_rules')
          .upsert({
            payment_reason: paymentReason,
            category,
            description: description || null
          }, {
            onConflict: 'payment_reason'
          });

        if (ruleError) throw ruleError;

        // Update all existing uncategorized transactions with the same payment_reason
        const { error } = await supabase
          .from('transactions')
          .update({ category, description })
          .eq('payment_reason', paymentReason)
          .is('category', null);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: `Updated all transactions with payment reason: "${paymentReason}" and created rule for future transactions`,
        });
      } else {
        // Update only this transaction
        const { error } = await supabase
          .from('transactions')
          .update({ category, description })
          .eq('Id', transactionId);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Transaction updated successfully",
        });
      }

      // Refresh the list
      await fetchUncategorizedTransactions();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update transaction",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Transaction Categorizer</h1>
            <p className="text-muted-foreground">
              {transactions.length} uncategorized transactions found
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="space-y-4">
          {transactions.map((transaction) => (
            <TransactionCard
              key={transaction.Id}
              transaction={transaction}
              onUpdate={updateTransaction}
              isUpdating={updating === transaction.Id}
            />
          ))}
          
          {transactions.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  🎉 All transactions are categorized!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

interface TransactionCardProps {
  transaction: Transaction;
  onUpdate: (id: string, category: string, description: string, applyToAll: boolean, paymentReason: string) => Promise<void>;
  isUpdating: boolean;
}

const TransactionCard = ({ transaction, onUpdate, isUpdating }: TransactionCardProps) => {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState(transaction.description || "");
  const [applyToAll, setApplyToAll] = useState(false);

  // Determine if this is a "Transferencia a Terceros" case
  const isTransferToThird = transaction.transaction_type === "Transferencia" && 
                           transaction.transferation_type === "Transferencia a Terceros";

  // Get the effective payment reason (use transferation_type for third party transfers)
  const effectivePaymentReason = isTransferToThird ? 
    transaction.transferation_type : 
    transaction.payment_reason;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category.trim()) return;
    
    onUpdate(transaction.Id, category.trim(), description.trim(), applyToAll, effectivePaymentReason);
  };

  const formatAmount = (amount: number, currency: string) => {
    if (currency === 'CLP') {
      return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(amount);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold text-foreground truncate">
              {effectivePaymentReason}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDate(transaction.transaction_timestamp_local)}
            </p>
          </div>
          <div className="text-right ml-4">
            <p className="text-lg font-bold text-foreground">
              {formatAmount(transaction.amount, transaction.currency)}
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`category-${transaction.Id}`}>Category *</Label>
              <Input
                id={`category-${transaction.Id}`}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Food, Transport, Shopping"
                required
                disabled={isUpdating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`description-${transaction.Id}`}>Description (optional)</Label>
              <Input
                id={`description-${transaction.Id}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional notes"
                disabled={isUpdating}
              />
            </div>
          </div>

          {!isTransferToThird && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`apply-all-${transaction.Id}`}
                checked={applyToAll}
                onCheckedChange={(checked) => setApplyToAll(checked === true)}
                disabled={isUpdating}
              />
              <Label htmlFor={`apply-all-${transaction.Id}`} className="text-sm">
                Always apply this category to "{effectivePaymentReason}"
              </Label>
            </div>
          )}

          <Button 
            type="submit" 
            disabled={!category.trim() || isUpdating}
            className="w-full md:w-auto"
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Save Category'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};