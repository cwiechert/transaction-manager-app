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
      <div className="max-w-7xl mx-auto">
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
  // Get all unique categories
  const allCategories = [...new Set(transactions.map(t => t.category).filter(Boolean))].sort();
  
  // Filter states - exclude "Inversion" and "Otros" by default
  const defaultExcludedCategories = ["Inversion", "Otros"];
  const availableCategories = allCategories.filter(cat => !defaultExcludedCategories.includes(cat));
  const [selectedCategories, setSelectedCategories] = useState<string[]>(availableCategories);
  const [selectedMonths, setSelectedMonths] = useState<number>(3); // Default to last 3 months
  
  // Filter transactions based on selected filters
  const filteredTransactions = transactions.filter(transaction => {
    // Always exclude "Pago de Tarjeta de Crédito"
    if (transaction.category === "Pago de Tarjeta de Crédito") {
      return false;
    }
    
    // Category filter - if we have selected categories, only show those
    if (selectedCategories.length > 0 && transaction.category) {
      if (!selectedCategories.includes(transaction.category)) {
        return false;
      }
    }
    
    // Month filter (skip if "All time" is selected)
    if (selectedMonths < 999) {
      const transactionDate = new Date(transaction.transaction_timestamp_local);
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - selectedMonths);
      
      if (transactionDate < cutoffDate) {
        return false;
      }
    }
    
    return true;
  });

  // Prepare data for category spending chart
  const categoryData = filteredTransactions.reduce((acc, transaction) => {
    const category = transaction.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + Math.abs(transaction.amount);
    return acc;
  }, {} as Record<string, number>);

  const categoryChartData = Object.entries(categoryData)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8); // Top 8 categories

  // Prepare data for monthly trends
  const monthlyData = filteredTransactions.reduce((acc, transaction) => {
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
  const uniqueCategories = [...new Set(filteredTransactions.map(t => t.category).filter(Boolean))];

  // Calculate current vs last month comparison
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
  
  const currentMonthSpending = filteredTransactions
    .filter(t => {
      const txDate = new Date(t.transaction_timestamp_local);
      const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      return txMonth === currentMonth;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const lastMonthSpending = filteredTransactions
    .filter(t => {
      const txDate = new Date(t.transaction_timestamp_local);
      const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      return txMonth === lastMonth;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const monthOverMonthChange = lastMonthSpending > 0 
    ? ((currentMonthSpending - lastMonthSpending) / lastMonthSpending) * 100 
    : 0;

  // Colors for charts
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#ffb347', '#87ceeb'];

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-card rounded-lg border">
        <div className="space-y-2">
          <Label>Categories</Label>
          <div className="relative">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => {
                const content = document.getElementById('category-dropdown');
                if (content) {
                  content.style.display = content.style.display === 'none' ? 'block' : 'none';
                }
              }}
            >
              {selectedCategories.length === availableCategories.length 
                ? "All categories (excluding Inversion & Otros)" 
                : selectedCategories.length === 0
                  ? "No categories selected"
                  : `${selectedCategories.length} categories selected`
              }
            </Button>
            <div 
              id="category-dropdown"
              className="absolute top-full left-0 w-full mt-1 bg-popover border rounded-md shadow-md z-50 max-h-48 overflow-y-auto"
              style={{ display: 'none' }}
            >
              <div className="p-2 space-y-2">
                <div className="flex items-center space-x-2 p-2 hover:bg-accent rounded">
                  <Checkbox
                    id="all-categories"
                    checked={selectedCategories.length === availableCategories.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCategories(availableCategories);
                      } else {
                        setSelectedCategories([]);
                      }
                    }}
                  />
                  <Label htmlFor="all-categories">All categories (excluding Inversion & Otros)</Label>
                </div>
                {allCategories.map(category => (
                  <div key={category} className="flex items-center space-x-2 p-2 hover:bg-accent rounded">
                    <Checkbox
                      id={`category-${category}`}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCategories(prev => [...prev, category]);
                        } else {
                          setSelectedCategories(prev => prev.filter(c => c !== category));
                        }
                      }}
                    />
                    <Label htmlFor={`category-${category}`} className="text-sm">{category}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedCategories.map(category => (
                <div key={category} className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                  {category}
                  <button 
                    onClick={() => setSelectedCategories(prev => prev.filter(c => c !== category))}
                    className="ml-1 hover:text-primary/70"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <Label>Time Period</Label>
          <Select value={selectedMonths.toString()} onValueChange={(value) => setSelectedMonths(parseInt(value))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 1 month</SelectItem>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
              <SelectItem value="999">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats - Moved to top */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0))}
            </div>
            <p className="text-muted-foreground text-sm">Total Spending</p>
            <div className="flex items-center justify-between mt-2 p-2 bg-muted/50 rounded-md">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Previous</div>
                <div className="text-sm font-medium">{new Intl.NumberFormat('es-CL', {
                  style: 'currency',
                  currency: 'CLP',
                  minimumFractionDigits: 0,
                  notation: 'compact'
                }).format(lastMonthSpending)}</div>
              </div>
              <div className="text-muted-foreground">→</div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Current</div>
                <div className="text-sm font-medium">{new Intl.NumberFormat('es-CL', {
                  style: 'currency',
                  currency: 'CLP',
                  minimumFractionDigits: 0,
                  notation: 'compact'
                }).format(currentMonthSpending)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{filteredTransactions.length}</div>
            <p className="text-muted-foreground text-sm">Total Transactions</p>
            <div className="flex items-center justify-between mt-2 p-2 bg-muted/50 rounded-md">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Previous</div>
                <div className="text-sm font-medium">{filteredTransactions.filter(t => {
                  const txDate = new Date(t.transaction_timestamp_local);
                  const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                  return txMonth === lastMonth;
                }).length}</div>
              </div>
              <div className="text-muted-foreground">→</div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Current</div>
                <div className="text-sm font-medium">{filteredTransactions.filter(t => {
                  const txDate = new Date(t.transaction_timestamp_local);
                  const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                  return txMonth === currentMonth;
                }).length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {(() => {
                const topCategory = categoryChartData[0];
                return topCategory ? topCategory.category : 'N/A';
              })()}
            </div>
            <p className="text-muted-foreground text-sm">Top Category</p>
            <div className="mt-2 p-2 bg-muted/50 rounded-md text-center">
              <div className="text-xs text-muted-foreground">Amount</div>
              <div className="text-sm font-medium">
                {(() => {
                  const topCategory = categoryChartData[0];
                  return topCategory ? new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: 'CLP',
                    minimumFractionDigits: 0,
                    notation: 'compact'
                  }).format(topCategory.amount) : '$0';
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {filteredTransactions.length > 0 ? new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / filteredTransactions.length) : '$0'}
            </div>
            <p className="text-muted-foreground text-sm">Average Transaction</p>
            <div className="flex items-center justify-between mt-2 p-2 bg-muted/50 rounded-md">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Previous</div>
                <div className="text-sm font-medium">{(() => {
                  const lastMonthTxs = filteredTransactions.filter(t => {
                    const txDate = new Date(t.transaction_timestamp_local);
                    const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                    return txMonth === lastMonth;
                  });
                  return lastMonthTxs.length > 0 
                    ? new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        minimumFractionDigits: 0,
                        notation: 'compact'
                      }).format(lastMonthTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0) / lastMonthTxs.length)
                    : '$0';
                })()}</div>
              </div>
              <div className="text-muted-foreground">→</div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Current</div>
                <div className="text-sm font-medium">{(() => {
                  const currentMonthTxs = filteredTransactions.filter(t => {
                    const txDate = new Date(t.transaction_timestamp_local);
                    const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                    return txMonth === currentMonth;
                  });
                  return currentMonthTxs.length > 0 
                    ? new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        minimumFractionDigits: 0,
                        notation: 'compact'
                      }).format(currentMonthTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0) / currentMonthTxs.length)
                    : '$0';
                })()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className={`text-2xl font-bold ${monthOverMonthChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
              {monthOverMonthChange >= 0 ? '+' : ''}{monthOverMonthChange.toFixed(1)}%
            </div>
            <p className="text-muted-foreground text-sm">vs Last Month</p>
            <div className="mt-2 text-center">
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                monthOverMonthChange >= 0 
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' 
                  : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              }`}>
                {monthOverMonthChange >= 0 ? '↗️' : '↘️'} 
                {monthOverMonthChange >= 0 ? 'Increased' : 'Decreased'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Spending Horizontal Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Spending by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categoryChartData.map((item, index) => {
                const total = categoryChartData.reduce((sum, cat) => sum + cat.amount, 0);
                const percentage = total > 0 ? ((item.amount / total) * 100) : 0;
                return (
                  <div key={item.category} className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium truncate">{item.category}</div>
                    <div className="flex-1 relative">
                      <div className="w-full bg-muted h-8 rounded-md overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-300" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-bold text-white drop-shadow-sm">
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                    <div className="w-24 text-right text-sm font-medium">
                      {new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        minimumFractionDigits: 0,
                        notation: 'compact'
                      }).format(item.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
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

      {/* Category Spending Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Category Spending Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            // Create heatmap data structure
            const heatmapData = filteredTransactions.reduce((acc, transaction) => {
              const date = new Date(transaction.transaction_timestamp_local);
              const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              const category = transaction.category || 'Uncategorized';
              
              if (!acc[category]) {
                acc[category] = {};
              }
              
              acc[category][monthKey] = (acc[category][monthKey] || 0) + Math.abs(transaction.amount);
              return acc;
            }, {} as Record<string, Record<string, number>>);

            // Get all months in the data, sorted
            const allMonths = [...new Set(
              filteredTransactions.map(t => {
                const date = new Date(t.transaction_timestamp_local);
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              })
            )]
            .sort()
            .slice(-12); // Last 12 months

            // Get all categories that have data
            const categoriesWithData = Object.keys(heatmapData)
              .filter(category => Object.keys(heatmapData[category]).length > 0)
              .sort();

            // Find max value for color scaling
            const maxValue = Math.max(
              ...Object.values(heatmapData).flatMap(monthData => 
                Object.values(monthData)
              )
            );

            const formatMonth = (monthKey: string) => {
              const [year, month] = monthKey.split('-');
              const date = new Date(parseInt(year), parseInt(month) - 1);
              return date.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
            };

            const getColorIntensity = (value: number) => {
              if (!value || maxValue === 0) return 0;
              return Math.min(value / maxValue, 1);
            };

            const formatCurrency = (value: number) => {
              return new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
                notation: 'compact'
              }).format(value);
            };

            return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-background border border-border p-2 text-left font-medium min-w-32">
                        Category
                      </th>
                      {allMonths.map(month => (
                        <th key={month} className="border border-border p-2 text-center font-medium min-w-20 text-xs">
                          {formatMonth(month)}
                        </th>
                      ))}
                      <th className="border border-border p-2 text-center font-medium min-w-20 text-xs">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoriesWithData.map(category => {
                      const categoryTotal = Object.values(heatmapData[category] || {})
                        .reduce((sum, val) => sum + val, 0);
                      
                      return (
                        <tr key={category}>
                          <td className="sticky left-0 bg-background border border-border p-2 font-medium text-sm">
                            {category}
                          </td>
                          {allMonths.map(month => {
                            const value = heatmapData[category]?.[month] || 0;
                            const intensity = getColorIntensity(value);
                            
                            return (
                              <td 
                                key={month} 
                                className="border border-border p-1 text-center text-xs relative"
                                style={{
                                  backgroundColor: value > 0 
                                    ? `hsl(var(--primary) / ${0.1 + intensity * 0.7})` 
                                    : 'transparent'
                                }}
                              >
                                {value > 0 && (
                                  <div className="font-medium">
                                    {formatCurrency(value)}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="border border-border p-1 text-center text-xs font-bold bg-muted">
                            {formatCurrency(categoryTotal)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-muted">
                      <td className="sticky left-0 bg-muted border border-border p-2 font-bold text-sm">
                        Total
                      </td>
                      {allMonths.map(month => {
                        const monthTotal = categoriesWithData.reduce((sum, category) => {
                          return sum + (heatmapData[category]?.[month] || 0);
                        }, 0);
                        
                        return (
                          <td key={month} className="border border-border p-1 text-center text-xs font-bold">
                            {formatCurrency(monthTotal)}
                          </td>
                        );
                      })}
                      <td className="border border-border p-1 text-center text-xs font-bold">
                        {formatCurrency(
                          categoriesWithData.reduce((sum, category) => {
                            return sum + Object.values(heatmapData[category] || {})
                              .reduce((catSum, val) => catSum + val, 0);
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
        </CardContent>
      </Card>
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