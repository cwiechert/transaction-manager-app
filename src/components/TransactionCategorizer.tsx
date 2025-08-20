import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Loader2, Edit, BarChart, PieChart, TrendingUp } from "lucide-react";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, Tooltip } from 'recharts';

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
  transferation_destination: string | null;
}

export const TransactionCategorizer = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [transactionLimit, setTransactionLimit] = useState(10);
  const { toast } = useToast();

  useEffect(() => {
    fetchUncategorizedTransactions();
    fetchRecentTransactions();
    fetchAllTransactions();
    fetchCategories();
  }, [transactionLimit]);

  const fetchUncategorizedTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('Id, payment_reason, amount, currency, transaction_timestamp_local, category, description, transaction_type, transferation_type, transferation_destination')
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

  const fetchRecentTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('Id, payment_reason, amount, currency, transaction_timestamp_local, category, description, transaction_type, transferation_type, transferation_destination')
        .neq('category', 'Pago de Tarjeta de Crédito')
        .order('transaction_timestamp_local', { ascending: false })
        .limit(transactionLimit);

      if (error) throw error;
      setRecentTransactions(data || []);
    } catch (error) {
      console.error('Failed to fetch recent transactions:', error);
    }
  };

  const fetchAllTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('Id, payment_reason, amount, currency, transaction_timestamp_local, category, description, transaction_type, transferation_type, transferation_destination')
        .not('category', 'is', null)
        .neq('category', 'Pago de Tarjeta de Crédito')
        .order('transaction_timestamp_local', { ascending: false });

      if (error) throw error;
      setAllTransactions(data || []);
    } catch (error) {
      console.error('Failed to fetch all transactions:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('category')
        .not('category', 'is', null)
        .order('category');

      if (error) throw error;
      
      const uniqueCategories = [...new Set(data?.map(item => item.category) || [])]
        .filter(category => category !== 'Pago de Tarjeta de Crédito'); // Hide auto-categorized items
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
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
            category
          }, {
            onConflict: 'payment_reason'
          });

        if (ruleError) throw ruleError;

        // Update all existing uncategorized transactions with the same payment_reason
        const { error } = await supabase
          .from('transactions')
          .update({ category })
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

      // Refresh the lists
      await fetchUncategorizedTransactions();
      await fetchRecentTransactions();
      await fetchAllTransactions();
      await fetchCategories();
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Transaction Manager</h1>
          </div>
          <ThemeToggle />
        </div>

        <Tabs defaultValue="categorize" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="categorize">Categorize Transactions</TabsTrigger>
            <TabsTrigger value="edit">Edit Recent Transactions</TabsTrigger>
            <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
          </TabsList>
          
          <TabsContent value="categorize" className="space-y-4">
            <div className="mb-4">
              <p className="text-muted-foreground">
                {transactions.length} uncategorized transactions found
              </p>
            </div>
            
            {transactions.map((transaction) => (
              <TransactionCard
                key={transaction.Id}
                transaction={transaction}
                categories={categories}
                onUpdate={updateTransaction}
                isUpdating={updating === transaction.Id}
                showApplyToAll={true}
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
          </TabsContent>
          
          <TabsContent value="edit" className="space-y-4">
            <div className="mb-4 flex justify-between items-center">
              <p className="text-muted-foreground">
                Showing last {transactionLimit} transactions
              </p>
              <div className="flex items-center gap-2">
                <Label htmlFor="limit">Show:</Label>
                <Select value={transactionLimit.toString()} onValueChange={(value) => setTransactionLimit(parseInt(value))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {recentTransactions.map((transaction) => (
              <TransactionCard
                key={transaction.Id}
                transaction={transaction}
                categories={categories}
                onUpdate={updateTransaction}
                isUpdating={updating === transaction.Id}
                showApplyToAll={false}
              />
            ))}
          </TabsContent>

          <TabsContent value="visualizations" className="space-y-6">
            <TransactionVisualizations transactions={allTransactions} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Visualization components
const TransactionVisualizations = ({ transactions }: { transactions: Transaction[] }) => {
  // Prepare data for category spending chart
  const categoryData = transactions.reduce((acc, transaction) => {
    const category = transaction.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + Math.abs(transaction.amount);
    return acc;
  }, {} as Record<string, number>);

  const categoryChartData = Object.entries(categoryData)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8); // Top 8 categories

  // Prepare data for monthly trends
  const monthlyData = transactions.reduce((acc, transaction) => {
    const date = new Date(transaction.transaction_timestamp_local);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    acc[monthKey] = (acc[monthKey] || 0) + Math.abs(transaction.amount);
    return acc;
  }, {} as Record<string, number>);

  const monthlyChartData = Object.entries(monthlyData)
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6); // Last 6 months

  // Get unique categories from transactions
  const uniqueCategories = [...new Set(transactions.map(t => t.category).filter(Boolean))];

  // Colors for charts
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#ffb347', '#87ceeb'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Spending Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Spending by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                  label={({ category, percent }) => `${category} (${(percent * 100).toFixed(0)}%)`}
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [
                    new Intl.NumberFormat('es-CL', {
                      style: 'currency',
                      currency: 'CLP',
                      minimumFractionDigits: 0,
                    }).format(value),
                    'Amount'
                  ]}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Spending Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Monthly Spending Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis 
                  tickFormatter={(value) => 
                    new Intl.NumberFormat('es-CL', {
                      style: 'currency',
                      currency: 'CLP',
                      minimumFractionDigits: 0,
                      notation: 'compact'
                    }).format(value)
                  }
                />
                <Tooltip
                  formatter={(value: number) => [
                    new Intl.NumberFormat('es-CL', {
                      style: 'currency',
                      currency: 'CLP',
                      minimumFractionDigits: 0,
                    }).format(value),
                    'Amount'
                  ]}
                />
                <Line type="monotone" dataKey="amount" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Comparison Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Top Categories Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <RechartsBarChart data={categoryChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="category" 
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis 
                tickFormatter={(value) => 
                  new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: 'CLP',
                    minimumFractionDigits: 0,
                    notation: 'compact'
                  }).format(value)
                }
              />
              <Tooltip
                formatter={(value: number) => [
                  new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: 'CLP',
                    minimumFractionDigits: 0,
                  }).format(value),
                  'Amount'
                ]}
              />
              <Bar dataKey="amount" fill="#8884d8" />
            </RechartsBarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0))}
            </div>
            <p className="text-muted-foreground text-sm">Total Spending</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{transactions.length}</div>
            <p className="text-muted-foreground text-sm">Total Transactions</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{uniqueCategories.length}</div>
            <p className="text-muted-foreground text-sm">Categories Used</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {transactions.length > 0 ? new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length) : '$0'}
            </div>
            <p className="text-muted-foreground text-sm">Average Transaction</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface TransactionCardProps {
  transaction: Transaction;
  categories: string[];
  onUpdate: (id: string, category: string, description: string, applyToAll: boolean, paymentReason: string) => Promise<void>;
  isUpdating: boolean;
  showApplyToAll: boolean;
}

const TransactionCard = ({ transaction, categories, onUpdate, isUpdating, showApplyToAll }: TransactionCardProps) => {
  const [category, setCategory] = useState(transaction.category || "");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [description, setDescription] = useState(transaction.description || "");
  const [applyToAll, setApplyToAll] = useState(false);

  // Determine if this is a "Transferencia a/para Terceros" case (handle both singular/plural variants)
  const isTransferToThird = transaction.transaction_type === "Transferencia" &&
    (transaction.transferation_type === "Transferencia a Terceros" || transaction.transferation_type === "Transferencias a Terceros");

  // Get the effective payment reason (use transferation_type for third party transfers)
  const effectivePaymentReason = isTransferToThird ?
    transaction.transferation_type :
    transaction.payment_reason;

  // Get the display title for the transaction
  const getDisplayTitle = () => {
    if (transaction.transaction_type === "Transferencia") {
      if (transaction.transferation_type === "Transferencia a Terceros" || transaction.transferation_type === "Transferencias a Terceros") {
        return transaction.transferation_destination 
          ? `Transferencias a terceros: ${transaction.transferation_destination}`
          : transaction.transferation_type || "Transferencia";
      }
      return transaction.transferation_type || transaction.payment_reason || "Transferencia";
    }
    return transaction.payment_reason;
  };

  const displayTitle = getDisplayTitle();

  const handleCategoryChange = (value: string) => {
    if (value === "add_new") {
      setShowCustomInput(true);
      setCategory("");
    } else {
      setShowCustomInput(false);
      setCategory(value);
      setCustomCategory("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = showCustomInput ? customCategory.trim() : category.trim();
    if (!finalCategory) return;
    
    onUpdate(transaction.Id, finalCategory, description.trim(), applyToAll, effectivePaymentReason);
  };

  const formatAmount = (amount: number, currency: string) => {
    console.log('Formatting amount:', amount, 'currency:', currency);
    
    if (currency === 'CLP') {
      return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    } else if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } else {
      // Fallback for unknown currencies
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
              {displayTitle}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDate(transaction.transaction_timestamp_local)}
            </p>
            {transaction.category && (
              <span className="inline-block mt-1 px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
                {transaction.category}
              </span>
            )}
          </div>
          <div className="text-right ml-4">
            <div className="flex items-baseline justify-end gap-2">
              <p className="text-lg font-bold text-foreground">
                {formatAmount(transaction.amount, transaction.currency)}
              </p>
              <span className="text-xs font-medium text-muted-foreground">
                {transaction.currency}
              </span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`category-${transaction.Id}`}>Category *</Label>
              {showCustomInput ? (
                <Input
                  id={`custom-category-${transaction.Id}`}
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Enter new category name"
                  required
                  disabled={isUpdating}
                />
              ) : (
                <Select value={category} onValueChange={handleCategoryChange} disabled={isUpdating}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                    <SelectItem value="add_new">
                      <span className="font-medium">+ Add new category</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`description-${transaction.Id}`}>Description</Label>
              <Input
                id={`description-${transaction.Id}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional notes"
                disabled={isUpdating}
              />
            </div>
          </div>

          {showApplyToAll && !isTransferToThird && (
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
            disabled={(!category.trim() && !customCategory.trim()) || isUpdating}
            className="w-full md:w-auto"
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Edit className="mr-2 h-4 w-4" />
                Update Transaction
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};