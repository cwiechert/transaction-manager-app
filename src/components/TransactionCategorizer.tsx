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
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VisualizationSettings } from "@/components/VisualizationSettings";
import { Loader2, Edit, BarChart3, TrendingUp, LogOut, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, Tooltip } from 'recharts';

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

interface CategorizationRule {
  id: string;
  payment_reason: string;
  category: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export const TransactionCategorizer = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categorizationRules, setCategorizationRules] = useState<CategorizationRule[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [transactionLimit, setTransactionLimit] = useState(10);
  const [showRules, setShowRules] = useState(false);
  const [visualizationSettings, setVisualizationSettings] = useState({
    defaultTimePeriod: 3,
    defaultSelectedCategories: [] as string[]
  });
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  useEffect(() => {
    fetchUncategorizedTransactions();
    fetchRecentTransactions();
    fetchAllTransactions();
    fetchCategories();
    fetchCategorizationRules();
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

  const fetchCategorizationRules = async () => {
    try {
      const { data, error } = await supabase
        .from('categorization_rules')
        .select('id, payment_reason, category, created_at, updated_at, user_id')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCategorizationRules(data || []);
    } catch (error) {
      console.error('Failed to fetch categorization rules:', error);
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
            user_id: user?.id
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
            {user && <p className="text-sm text-muted-foreground">Welcome, {user.email}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setShowRules(!showRules)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              size="sm"
            >
              {showRules ? 'Hide Rules' : 'Manage Rules'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {showRules && (
          <div className="mb-6">
            <CategorizationRulesManager 
              rules={categorizationRules}
              categories={categories}
              onRulesUpdate={fetchCategorizationRules}
              allTransactions={allTransactions}
            />
          </div>
        )}

        <Tabs defaultValue="categorize" className="w-full">
          <TabsList className="grid w-full grid-cols-3 gap-1">
            <TabsTrigger value="categorize" className="text-xs sm:text-sm px-2 sm:px-4">
              <span className="hidden sm:inline">Uncategorized Transactions</span>
              <span className="sm:hidden">Transactions</span>
            </TabsTrigger>
            <TabsTrigger value="edit" className="text-xs sm:text-sm px-2 sm:px-4">
              <span className="hidden sm:inline">Edit Recent</span>
              <span className="sm:hidden">Recent</span>
            </TabsTrigger>
            <TabsTrigger value="visualizations" className="text-xs sm:text-sm px-2 sm:px-4">
              Visualizations
            </TabsTrigger>
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
                categorizationRules={categorizationRules}
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
                showApplyToAll={true}
                categorizationRules={categorizationRules}
              />
            ))}
          </TabsContent>

          <TabsContent value="visualizations" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Visualizations</h2>
              <VisualizationSettings 
                categories={categories}
                onSettingsChange={setVisualizationSettings}
              />
            </div>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-2 gap-1">
                <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-4">Overview</TabsTrigger>
                <TabsTrigger value="category-analysis" className="text-xs sm:text-sm px-2 sm:px-4">
                  <span className="hidden sm:inline">Category Analysis</span>
                  <span className="sm:hidden">Analysis</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-6">
                <TransactionVisualizations 
                  transactions={allTransactions} 
                  defaultSettings={visualizationSettings}
                />
              </TabsContent>
              
              <TabsContent value="category-analysis" className="space-y-6">
                <CategoryAnalysisWrapper transactions={allTransactions} />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Categorization Rules Manager Component
const CategorizationRulesManager = ({ 
  rules, 
  categories, 
  onRulesUpdate,
  allTransactions
}: { 
  rules: CategorizationRule[], 
  categories: string[], 
  onRulesUpdate: () => void,
  allTransactions: Transaction[]
}) => {
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof CategorizationRule | 'event_count'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState({
    payment_reason: '',
    category: ''
  });
  const { toast } = useToast();

  // Get unique values for dropdowns
  const uniquePaymentReasons = [...new Set(rules.map(rule => rule.payment_reason))].sort();
  const uniqueCategories = [...new Set(rules.map(rule => rule.category))].sort();

  // Calculate event counts for each rule
  const getEventCount = (paymentReason: string) => {
    return allTransactions.filter(transaction => 
      transaction.payment_reason === paymentReason
    ).length;
  };

  // Filter and sort rules
  const filteredAndSortedRules = rules
    .filter(rule => {
      const matchesPaymentReason = filters.payment_reason === 'all' || !filters.payment_reason || rule.payment_reason === filters.payment_reason;
      const matchesCategory = filters.category === 'all' || !filters.category || rule.category === filters.category;
      return matchesPaymentReason && matchesCategory;
    })
    .sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      
      if (sortField === 'event_count') {
        const aCount = getEventCount(a.payment_reason);
        const bCount = getEventCount(b.payment_reason);
        return (aCount - bCount) * direction;
      } else {
        const aValue = a[sortField as keyof CategorizationRule];
        const bValue = b[sortField as keyof CategorizationRule];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue) * direction;
        }
      }
      return 0;
    });

  const handleSort = (field: keyof CategorizationRule | 'event_count') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const updateRule = async (ruleId: string, updates: Partial<CategorizationRule>) => {
    try {
      const { error } = await supabase
        .from('categorization_rules')
        .update(updates)
        .eq('id', ruleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Rule updated successfully",
      });

      onRulesUpdate();
      setEditingRule(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update rule",
        variant: "destructive",
      });
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('categorization_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Rule deleted successfully",
      });

      onRulesUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete rule",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Categorization Rules</h3>
        <p className="text-sm text-muted-foreground">{filteredAndSortedRules.length} rules</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-card rounded-lg border">
        <div className="space-y-2">
          <Label htmlFor="payment-reason-filter">Filter by Payment Reason</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between"
              >
                {filters.payment_reason || "All payment reasons"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Search payment reasons..." />
                <CommandList>
                  <CommandEmpty>No payment reason found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => setFilters(prev => ({ ...prev, payment_reason: '' }))}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          !filters.payment_reason ? "opacity-100" : "opacity-0"
                        )}
                      />
                      All payment reasons
                    </CommandItem>
                    {uniquePaymentReasons.map((reason) => (
                      <CommandItem
                        key={reason}
                        value={reason}
                        onSelect={(currentValue) => {
                          setFilters(prev => ({ 
                            ...prev, 
                            payment_reason: currentValue === filters.payment_reason ? '' : currentValue
                          }))
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            filters.payment_reason === reason ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {reason}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category-filter">Filter by Category</Label>
          <Select
            value={filters.category || 'all'}
            onValueChange={(value) => setFilters(prev => ({ ...prev, category: value === 'all' ? '' : value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {uniqueCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Rules Table */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort('payment_reason')}
                    className="font-semibold h-auto p-0 hover:bg-transparent"
                  >
                    Payment Reason
                    <span className="ml-2">
                      {sortField === 'payment_reason' ? (
                        sortDirection === 'asc' ? '↑' : '↓'
                      ) : '↕'}
                    </span>
                  </Button>
                </th>
                <th className="text-left p-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort('category')}
                    className="font-semibold h-auto p-0 hover:bg-transparent"
                  >
                    Category
                    <span className="ml-2">
                      {sortField === 'category' ? (
                        sortDirection === 'asc' ? '↑' : '↓'
                      ) : '↕'}
                    </span>
                  </Button>
                </th>
                <th className="text-left p-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort('created_at')}
                    className="font-semibold h-auto p-0 hover:bg-transparent"
                  >
                    Created At
                    <span className="ml-2">
                      {sortField === 'created_at' ? (
                        sortDirection === 'asc' ? '↑' : '↓'
                      ) : '↕'}
                    </span>
                  </Button>
                </th>
                <th className="text-left p-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort('event_count')}
                    className="font-semibold h-auto p-0 hover:bg-transparent"
                  >
                    Number of Events
                    <span className="ml-2">
                      {sortField === 'event_count' ? (
                        sortDirection === 'asc' ? '↑' : '↓'
                      ) : '↕'}
                    </span>
                  </Button>
                </th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedRules.map((rule) => (
                <CategorizationRuleRow
                  key={rule.id}
                  rule={rule}
                  categories={categories}
                  eventCount={getEventCount(rule.payment_reason)}
                  isEditing={editingRule === rule.id}
                  onEdit={() => setEditingRule(rule.id)}
                  onSave={(updates) => updateRule(rule.id, updates)}
                  onCancel={() => setEditingRule(null)}
                  onDelete={() => deleteRule(rule.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredAndSortedRules.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No categorization rules found matching your filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Individual rule row component
const CategorizationRuleRow = ({
  rule,
  categories,
  eventCount,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete
}: {
  rule: CategorizationRule;
  categories: string[];
  eventCount: number;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updates: Partial<CategorizationRule>) => void;
  onCancel: () => void;
  onDelete: () => void;
}) => {
  const [editData, setEditData] = useState({
    payment_reason: rule.payment_reason,
    category: rule.category
  });

  useEffect(() => {
    if (isEditing) {
      setEditData({
        payment_reason: rule.payment_reason,
        category: rule.category
      });
    }
  }, [isEditing, rule]);

  const handleSave = () => {
    onSave(editData);
  };

  return (
    <tr className="border-b hover:bg-muted/25">
      <td className="p-4">
        {isEditing ? (
          <Input
            value={editData.payment_reason}
            onChange={(e) => setEditData(prev => ({ ...prev, payment_reason: e.target.value }))}
            className="min-w-[200px]"
          />
        ) : (
          <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded" onClick={onEdit}>
            <span className="break-all">{rule.payment_reason}</span>
            <Edit className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
      </td>
      <td className="p-4">
        {isEditing ? (
          <Select
            value={editData.category}
            onValueChange={(value) => setEditData(prev => ({ ...prev, category: value }))}
          >
            <SelectTrigger className="min-w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded" onClick={onEdit}>
            <span>{rule.category}</span>
            <Edit className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
      </td>
      <td className="p-4 text-sm text-muted-foreground">
        {new Date(rule.created_at).toLocaleString()}
      </td>
      <td className="p-4 text-center">
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
          {eventCount}
        </span>
      </td>
      <td className="p-4">
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={() => {
                  if (confirm('Are you sure you want to delete this rule?')) {
                    onDelete();
                  }
                }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

// Visualization components
interface DefaultVisualizationSettings {
  defaultTimePeriod: number;
  defaultSelectedCategories: string[];
}

const TransactionVisualizations = ({ 
  transactions, 
  defaultSettings 
}: { 
  transactions: Transaction[];
  defaultSettings?: DefaultVisualizationSettings;
}) => {
  // Get all unique categories
  const allCategories = [...new Set(transactions.map(t => t.category).filter(Boolean))].sort();
  
  // Use all categories (no exclusions)
  const availableCategories = allCategories;
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number>(3);
  const [categoryChartView, setCategoryChartView] = useState<'filtered' | 'current'>('filtered');
  const [usdToClp, setUsdToClp] = useState<number>(900);

  // Apply default settings when they become available
  useEffect(() => {
    // Only apply settings when we have available categories and either have default settings or confirmed no default settings
    if (availableCategories.length > 0) {
      if (defaultSettings?.defaultSelectedCategories) {
        const validCategories = defaultSettings.defaultSelectedCategories.filter(cat => availableCategories.includes(cat));
        if (validCategories.length > 0) {
          setSelectedCategories(validCategories);
        } else {
          setSelectedCategories(availableCategories);
        }
        setSelectedMonths(defaultSettings.defaultTimePeriod);
      } else if (defaultSettings && defaultSettings.defaultSelectedCategories.length === 0) {
        // Default settings loaded but no categories specified - use all
        setSelectedCategories(availableCategories);
        setSelectedMonths(defaultSettings.defaultTimePeriod);
      }
      // If defaultSettings is undefined, wait for it to load - don't set any categories yet
    }
  }, [defaultSettings, availableCategories]);

  useEffect(() => {
    (async () => {
      try {
        // Use exchangerate-api.com which doesn't require API key for basic usage
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        if (data?.rates?.CLP) setUsdToClp(data.rates.CLP);
      } catch (e) {
        console.warn('Failed to fetch USD->CLP rate, using fallback 950', e);
        setUsdToClp(950); // Updated fallback rate
      }
    })();
  }, []);
  
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
      cutoffDate.setDate(1); // Set to first day of the month for whole month granularity
      cutoffDate.setHours(0, 0, 0, 0); // Set to start of day
      
      if (transactionDate < cutoffDate) {
        return false;
      }
    }
    
    return true;
  });

  // Calculate current vs last month comparison
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // Prepare data for category spending chart
  const categoryData = (categoryChartView === 'current' 
    ? filteredTransactions.filter(t => {
        const txDate = new Date(t.transaction_timestamp_local);
        const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
        return txMonth === currentMonth;
      })
    : filteredTransactions
  ).reduce((acc, transaction) => {
    const category = transaction.category || 'Uncategorized';
    const amountInClp = transaction.currency === 'USD' ? transaction.amount * usdToClp : transaction.amount;
    acc[category] = (acc[category] || 0) + Math.abs(amountInClp);
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
    const amountInClp = transaction.currency === 'USD' ? transaction.amount * usdToClp : transaction.amount;
    acc[monthKey] = (acc[monthKey] || 0) + Math.abs(amountInClp);
    return acc;
  }, {} as Record<string, number>);

  const monthlyChartData = Object.entries(monthlyData)
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6); // Last 6 months


  // Get unique categories from transactions
  const uniqueCategories = [...new Set(filteredTransactions.map(t => t.category).filter(Boolean))];

  const currentMonthSpending = filteredTransactions
    .filter(t => {
      const txDate = new Date(t.transaction_timestamp_local);
      const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      return txMonth === currentMonth;
    })
    .reduce((sum, t) => sum + Math.abs(t.currency === 'USD' ? t.amount * usdToClp : t.amount), 0);

  const lastMonthSpending = filteredTransactions
    .filter(t => {
      const txDate = new Date(t.transaction_timestamp_local);
      const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      return txMonth === lastMonth;
    })
    .reduce((sum, t) => sum + Math.abs(t.currency === 'USD' ? t.amount * usdToClp : t.amount), 0);

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
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
              >
                {selectedCategories.length === availableCategories.length 
                  ? "All categories" 
                  : selectedCategories.length === 0
                    ? "No categories selected"
                    : `${selectedCategories.length} categories selected`
                }
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0">
              <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
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
                  <Label htmlFor="all-categories">All categories</Label>
                </div>
                {availableCategories.map(category => (
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
            </PopoverContent>
          </Popover>
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
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(filteredTransactions.reduce((sum, t) => sum + Math.abs(t.currency === 'USD' ? t.amount * usdToClp : t.amount), 0))}
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
          <CardContent className="p-6 text-center">
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
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold">
              {(() => {
                // Get current month top category
                const currentMonthTxs = filteredTransactions.filter(t => {
                  const txDate = new Date(t.transaction_timestamp_local);
                  const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                  return txMonth === currentMonth;
                });
                
                const currentMonthCategories = currentMonthTxs.reduce((acc, t) => {
                  const category = t.category || 'Uncategorized';
                  const amountInClp = t.currency === 'USD' ? t.amount * usdToClp : t.amount;
                  acc[category] = (acc[category] || 0) + Math.abs(amountInClp);
                  return acc;
                }, {} as Record<string, number>);
                
                const currentTopCategory = Object.entries(currentMonthCategories)
                  .sort(([,a], [,b]) => b - a)[0];
                
                return currentTopCategory ? currentTopCategory[0] : 'N/A';
              })()}
            </div>
            <p className="text-muted-foreground text-sm">Top Category (Current)</p>
            <div className="flex items-center justify-between mt-2 p-2 bg-muted/50 rounded-md">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Previous</div>
                <div className="text-xs font-medium truncate max-w-16">
                  {(() => {
                    // Get previous month top category
                    const lastMonthTxs = filteredTransactions.filter(t => {
                      const txDate = new Date(t.transaction_timestamp_local);
                      const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                      return txMonth === lastMonth;
                    });
                    
                    const lastMonthCategories = lastMonthTxs.reduce((acc, t) => {
                      const category = t.category || 'Uncategorized';
                      const amountInClp = t.currency === 'USD' ? t.amount * usdToClp : t.amount;
                      acc[category] = (acc[category] || 0) + Math.abs(amountInClp);
                      return acc;
                    }, {} as Record<string, number>);
                    
                    const lastTopCategory = Object.entries(lastMonthCategories)
                      .sort(([,a], [,b]) => b - a)[0];
                    
                    return lastTopCategory ? lastTopCategory[0] : 'N/A';
                  })()}
                </div>
                <div className="text-xs font-medium">
                  {(() => {
                    const lastMonthTxs = filteredTransactions.filter(t => {
                      const txDate = new Date(t.transaction_timestamp_local);
                      const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                      return txMonth === lastMonth;
                    });
                    
                    const lastMonthCategories = lastMonthTxs.reduce((acc, t) => {
                      const category = t.category || 'Uncategorized';
                      const amountInClp = t.currency === 'USD' ? t.amount * usdToClp : t.amount;
                      acc[category] = (acc[category] || 0) + Math.abs(amountInClp);
                      return acc;
                    }, {} as Record<string, number>);
                    
                    const lastTopCategory = Object.entries(lastMonthCategories)
                      .sort(([,a], [,b]) => b - a)[0];
                    
                    return lastTopCategory ? new Intl.NumberFormat('es-CL', {
                      style: 'currency',
                      currency: 'CLP',
                      minimumFractionDigits: 0,
                      notation: 'compact'
                    }).format(lastTopCategory[1]) : '$0';
                  })()}
                </div>
              </div>
              <div className="text-muted-foreground">→</div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Current</div>
                <div className="text-xs font-medium truncate max-w-16">
                  {(() => {
                    const currentMonthTxs = filteredTransactions.filter(t => {
                      const txDate = new Date(t.transaction_timestamp_local);
                      const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                      return txMonth === currentMonth;
                    });
                    
                    const currentMonthCategories = currentMonthTxs.reduce((acc, t) => {
                      const category = t.category || 'Uncategorized';
                      const amountInClp = t.currency === 'USD' ? t.amount * usdToClp : t.amount;
                      acc[category] = (acc[category] || 0) + Math.abs(amountInClp);
                      return acc;
                    }, {} as Record<string, number>);
                    
                    const currentTopCategory = Object.entries(currentMonthCategories)
                      .sort(([,a], [,b]) => b - a)[0];
                    
                    return currentTopCategory ? currentTopCategory[0] : 'N/A';
                  })()}
                </div>
                <div className="text-xs font-medium">
                  {(() => {
                    const currentMonthTxs = filteredTransactions.filter(t => {
                      const txDate = new Date(t.transaction_timestamp_local);
                      const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                      return txMonth === currentMonth;
                    });
                    
                    const currentMonthCategories = currentMonthTxs.reduce((acc, t) => {
                      const category = t.category || 'Uncategorized';
                      const amountInClp = t.currency === 'USD' ? t.amount * usdToClp : t.amount;
                      acc[category] = (acc[category] || 0) + Math.abs(amountInClp);
                      return acc;
                    }, {} as Record<string, number>);
                    
                    const currentTopCategory = Object.entries(currentMonthCategories)
                      .sort(([,a], [,b]) => b - a)[0];
                    
                    return currentTopCategory ? new Intl.NumberFormat('es-CL', {
                      style: 'currency',
                      currency: 'CLP',
                      minimumFractionDigits: 0,
                      notation: 'compact'
                    }).format(currentTopCategory[1]) : '$0';
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold">
              {filteredTransactions.length > 0 ? new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(filteredTransactions.reduce((sum, t) => sum + Math.abs(t.currency === 'USD' ? t.amount * usdToClp : t.amount), 0) / filteredTransactions.length) : '$0'}
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
                      }).format(lastMonthTxs.reduce((sum, t) => sum + Math.abs(t.currency === 'USD' ? t.amount * usdToClp : t.amount), 0) / lastMonthTxs.length)
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
                      }).format(currentMonthTxs.reduce((sum, t) => sum + Math.abs(t.currency === 'USD' ? t.amount * usdToClp : t.amount), 0) / currentMonthTxs.length)
                    : '$0';
                })()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col justify-center items-center h-full">
            <div className={`text-2xl font-bold ${monthOverMonthChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
              {monthOverMonthChange >= 0 ? '+' : ''}{monthOverMonthChange.toFixed(1)}%
            </div>
            <p className="text-muted-foreground text-sm">vs Last Month</p>
          </CardContent>
        </Card>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <XAxis 
                  dataKey="month" 
                  tickFormatter={(month) => {
                    const [year, monthNum] = month.split('-');
                    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
                    return date.toLocaleDateString('es-CL', { 
                      month: 'short', 
                      year: '2-digit' 
                    });
                  }}
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
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const [year, monthNum] = (label as string).split('-');
                      const date = new Date(parseInt(year), parseInt(monthNum) - 1);
                      const formattedDate = date.toLocaleDateString('es-CL', { 
                        month: 'long', 
                        year: 'numeric' 
                      });
                      const amount = new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        minimumFractionDigits: 0,
                      }).format(payload[0].value as number);
                      
                      return (
                        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-medium text-popover-foreground">{formattedDate}</p>
                          <p className="text-primary font-bold">{amount}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="amount" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Spending Horizontal Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Spending by Category
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">View:</Label>
                <Select value={categoryChartView} onValueChange={(value: 'filtered' | 'current') => setCategoryChartView(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="filtered">Filtered Period</SelectItem>
                    <SelectItem value="current">Current Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                      <div 
                        className="absolute top-1/2 transform -translate-y-1/2 text-xs font-bold text-foreground ml-2"
                        style={{ left: `${Math.max(percentage, 15)}%` }}
                      >
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
      </div>

      {/* Category Spending Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-green-400 to-green-600 rounded-sm"></div>
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
              
              const amountInClp = transaction.currency === 'USD' ? transaction.amount * usdToClp : transaction.amount;
              acc[category][monthKey] = (acc[category][monthKey] || 0) + Math.abs(amountInClp);
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
                                    ? `hsl(120 ${Math.round(40 + intensity * 60)}% ${Math.round(70 - intensity * 50)}%)` 
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

      {/* Category Monthly Change - Diverging Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Category Monthly Change
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Green bars show increases, red bars show decreases from previous month
          </p>
        </CardHeader>
        <CardContent>
          {(() => {
            // Calculate monthly spending by category and percentage changes
            const monthlyByCategory = filteredTransactions.reduce((acc, transaction) => {
              const date = new Date(transaction.transaction_timestamp_local);
              const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              const category = transaction.category || 'Uncategorized';
              
              if (!acc[category]) {
                acc[category] = {};
              }
              
              const amountInClp = transaction.currency === 'USD' ? transaction.amount * usdToClp : transaction.amount;
              acc[category][monthKey] = (acc[category][monthKey] || 0) + Math.abs(amountInClp);
              return acc;
            }, {} as Record<string, Record<string, number>>);

            // Get last 4 months sorted (fewer months for better readability)
            const allMonths = [...new Set(
              filteredTransactions.map(t => {
                const date = new Date(t.transaction_timestamp_local);
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              })
            )].sort().slice(-4);

            // Get top categories by total spending
            const topCategories = Object.keys(monthlyByCategory)
              .map(category => ({
                category,
                totalSpending: Object.values(monthlyByCategory[category] || {}).reduce((sum, val) => sum + val, 0)
              }))
              .sort((a, b) => b.totalSpending - a.totalSpending)
              .slice(0, 6) // Top 6 categories
              .map(item => item.category);

            // Calculate changes for each month and category
            const changeData = allMonths.slice(1).map(month => { // Skip first month (no previous data)
              const monthIndex = allMonths.indexOf(month);
              const prevMonth = allMonths[monthIndex - 1];
              
              const formattedMonth = (() => {
                const [year, monthNum] = month.split('-');
                const date = new Date(parseInt(year), parseInt(monthNum) - 1);
                return date.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
              })();

              const categoryChanges = topCategories.map(category => {
                const currentAmount = monthlyByCategory[category]?.[month] || 0;
                const prevAmount = monthlyByCategory[category]?.[prevMonth] || 0;
                
                let change = 0;
                if (prevAmount > 0) {
                  change = ((currentAmount - prevAmount) / prevAmount) * 100;
                } else if (currentAmount > 0) {
                  change = 100; // New spending = 100% increase
                }
                
                // Cap extreme values for better visualization
                change = Math.max(-100, Math.min(150, change));
                
                return {
                  category,
                  change: Math.round(change * 10) / 10, // Round to 1 decimal
                  currentAmount,
                  prevAmount
                };
              }).filter(item => item.currentAmount > 0 || item.prevAmount > 0); // Only show categories with activity

              return {
                month: formattedMonth,
                changes: categoryChanges
              };
            });

            return (
              <div className="space-y-6">
                {changeData.map(({ month, changes }) => (
                  <div key={month} className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">{month}</h4>
                    <div className="space-y-2">
                      {changes.map(({ category, change, currentAmount, prevAmount }) => (
                        <div key={category} className="flex items-center gap-4">
                          <div className="w-28 text-sm font-medium truncate flex-shrink-0">
                            {category}
                          </div>
                          
                          <div className="flex-1 relative">
                            <div className="flex items-center h-8">
                              {/* Background scale */}
                              <div className="absolute inset-0 flex items-center">
                                <div className="w-1/2 border-r border-border"></div>
                              </div>
                              
                              {/* Bar */}
                              <div className="relative w-full flex items-center justify-center">
                                {change !== 0 && (
                                  <div
                                    className={`h-6 ${change > 0 ? 'bg-green-500' : 'bg-red-500'} transition-all duration-300`}
                                    style={{
                                      width: `${Math.abs(change) / 150 * 50}%`, // Scale to half width max
                                      marginLeft: change > 0 ? '50%' : `${50 - (Math.abs(change) / 150 * 50)}%`
                                    }}
                                  />
                                )}
                                
                                {/* Center line */}
                                <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-8 bg-border"></div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="w-16 text-right text-sm font-medium flex-shrink-0">
                            <span className={change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-muted-foreground'}>
                              {change > 0 ? '+' : ''}{change.toFixed(1)}%
                            </span>
                          </div>
                          
                          <div className="w-24 text-right text-xs text-muted-foreground flex-shrink-0">
                            {new Intl.NumberFormat('es-CL', {
                              style: 'currency',
                              currency: 'CLP',
                              notation: 'compact',
                              minimumFractionDigits: 0
                            }).format(currentAmount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {changeData.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Not enough data to show monthly changes
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Current Month Transaction List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-blue-400 to-blue-600 rounded-sm"></div>
            Current Month Transactions
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            All transactions from {(() => {
              const now = new Date();
              return now.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
            })()} sorted by amount (CLP, converted when needed)
          </p>
        </CardHeader>
        <CardContent>
          {(() => {
            // Get current month transactions
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            const currentMonthTransactions = filteredTransactions
              .filter(t => {
                const txDate = new Date(t.transaction_timestamp_local);
                const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                return txMonth === currentMonth;
              })
              .sort((a, b) => {
                const toCLP = (t: Transaction) => Math.abs(t.currency === 'USD' ? t.amount * usdToClp : t.amount);
                return toCLP(b) - toCLP(a);
              });

            if (currentMonthTransactions.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found for the current month
                </div>
              );
            }

            return (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {currentMonthTransactions.map((transaction) => (
                  <div key={transaction.Id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {transaction.category && (
                          <span className="inline-block px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
                            {transaction.category}
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium text-sm truncate">
                        {transaction.payment_reason || `Transferencia: ${transaction.transferation_destination || 'N/A'}`}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.transaction_timestamp_local).toLocaleDateString('es-CL', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {transaction.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {transaction.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-bold text-sm">
                        {new Intl.NumberFormat('es-CL', {
                          style: 'currency',
                          currency: 'CLP',
                          minimumFractionDigits: 0,
                        }).format(Math.abs(transaction.currency === 'USD' ? transaction.amount * usdToClp : transaction.amount))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        CLP
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

// Category Analysis Component
const CategoryAnalysis = ({ transactions, usdToClp }: { transactions: Transaction[], usdToClp: number }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Otros');
  const [selectedMonths, setSelectedMonths] = useState<number>(3);
  
  // Get unique categories
  const allCategories = [...new Set(transactions.map(t => t.category).filter(Boolean))].sort();
  
  // Filter transactions based on category and time period
  const filteredTransactions = transactions.filter(transaction => {
    // Category filter
    if (transaction.category !== selectedCategory) {
      return false;
    }
    
    // Month filter
    const transactionDate = new Date(transaction.transaction_timestamp_local);
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - selectedMonths);
    cutoffDate.setDate(1); // Set to first day of the month for whole month granularity
    cutoffDate.setHours(0, 0, 0, 0); // Set to start of day
    
    if (transactionDate < cutoffDate) {
      return false;
    }
    
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-card rounded-lg border">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allCategories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Payment Reason vs Month Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-purple-400 to-purple-600 rounded-sm"></div>
            Payment Reason by Month - {selectedCategory}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Shows spending patterns for each payment reason across the selected time period
          </p>
        </CardHeader>
        <CardContent>
          {(() => {
            // Create table data structure
            const tableData = filteredTransactions.reduce((acc, transaction) => {
              const date = new Date(transaction.transaction_timestamp_local);
              const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              const paymentReason = transaction.payment_reason || `Transferencia: ${transaction.transferation_destination || 'N/A'}`;
              
              if (!acc[paymentReason]) {
                acc[paymentReason] = {};
              }
              
              const amountInClp = transaction.currency === 'USD' ? transaction.amount * usdToClp : transaction.amount;
              acc[paymentReason][monthKey] = (acc[paymentReason][monthKey] || 0) + Math.abs(amountInClp);
              return acc;
            }, {} as Record<string, Record<string, number>>);

            // Get all months in the data, sorted
            const allMonths = [...new Set(
              filteredTransactions.map(t => {
                const date = new Date(t.transaction_timestamp_local);
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              })
            )].sort();

            // Get all payment reasons that have data
            const paymentReasons = Object.keys(tableData)
              .filter(reason => Object.keys(tableData[reason]).length > 0)
              .sort();

            // Find max value for heatmap color scaling
            const maxValue = Math.max(
              ...Object.values(tableData).flatMap(monthData => 
                Object.values(monthData)
              )
            );

            const getHeatmapColor = (value: number) => {
              if (!value || maxValue === 0) return 'transparent';
              const intensity = Math.min(value / maxValue, 1);
              return `hsl(25 ${Math.round(70 + intensity * 30)}% ${Math.round(75 - intensity * 45)}%)`;
            };

            const formatMonth = (monthKey: string) => {
              const [year, month] = monthKey.split('-');
              const date = new Date(parseInt(year), parseInt(month) - 1);
              return date.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
            };

            const formatCurrency = (value: number) => {
              return new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
                notation: 'compact'
              }).format(value);
            };

            if (paymentReasons.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found for category "{selectedCategory}" in the selected time period
                </div>
              );
            }

            return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-background border border-border p-3 text-left font-medium min-w-48">
                        Payment Reason
                      </th>
                      {allMonths.map(month => (
                        <th key={month} className="border border-border p-3 text-center font-medium min-w-24 text-sm">
                          {formatMonth(month)}
                        </th>
                      ))}
                      <th className="border border-border p-3 text-center font-medium min-w-24 text-sm">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentReasons.map(paymentReason => {
                      const reasonTotal = Object.values(tableData[paymentReason] || {})
                        .reduce((sum, val) => sum + val, 0);
                      
                      return (
                        <tr key={paymentReason} className="hover:bg-muted/50">
                          <td className="sticky left-0 bg-background border border-border p-3 font-medium text-sm">
                            {paymentReason}
                          </td>
                          {allMonths.map(month => {
                            const value = tableData[paymentReason]?.[month] || 0;
                            
                            return (
                              <td 
                                key={month} 
                                className="border border-border p-3 text-center text-sm relative"
                                style={{
                                  backgroundColor: getHeatmapColor(value)
                                }}
                              >
                                {value > 0 && (
                                  <div className="font-medium text-foreground">
                                    {formatCurrency(value)}
                                  </div>
                                )}
                                {value === 0 && (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="border border-border p-3 text-center text-sm font-bold bg-muted">
                            {formatCurrency(reasonTotal)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-muted font-bold">
                      <td className="sticky left-0 bg-muted border border-border p-3 font-bold text-sm">
                        Total
                      </td>
                      {allMonths.map(month => {
                        const monthTotal = paymentReasons.reduce((sum, reason) => {
                          return sum + (tableData[reason]?.[month] || 0);
                        }, 0);
                        
                        return (
                          <td key={month} className="border border-border p-3 text-center text-sm font-bold">
                            {formatCurrency(monthTotal)}
                          </td>
                        );
                      })}
                      <td className="border border-border p-3 text-center text-sm font-bold">
                        {formatCurrency(
                          paymentReasons.reduce((sum, reason) => {
                            return sum + Object.values(tableData[reason] || {})
                              .reduce((reasonSum, val) => reasonSum + val, 0);
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

// Category Analysis Wrapper with its own usdToClp state
const CategoryAnalysisWrapper = ({ transactions }: { transactions: Transaction[] }) => {
  const [usdToClp, setUsdToClp] = useState<number>(950);

  useEffect(() => {
    (async () => {
      try {
        // Use exchangerate-api.com which doesn't require API key for basic usage
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        if (data?.rates?.CLP) setUsdToClp(data.rates.CLP);
      } catch (e) {
        console.warn('Failed to fetch USD->CLP rate, using fallback 950', e);
        setUsdToClp(950); // Updated fallback rate
      }
    })();
  }, []);

  return <CategoryAnalysis transactions={transactions} usdToClp={usdToClp} />;
};
interface TransactionCardProps {
  transaction: Transaction;
  categories: string[];
  onUpdate: (id: string, category: string, description: string, applyToAll: boolean, paymentReason: string) => Promise<void>;
  isUpdating: boolean;
  showApplyToAll: boolean;
  categorizationRules: CategorizationRule[];
}

const TransactionCard = ({ transaction, categories, onUpdate, isUpdating, showApplyToAll, categorizationRules }: TransactionCardProps) => {
  const [category, setCategory] = useState(transaction.category || "");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [description, setDescription] = useState(transaction.description || "");
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [isEditingAmount, setIsEditingAmount] = useState(false);

  // Determine if this is a "Transferencia a/para Terceros" case (handle both singular/plural variants)
  const isTransferToThird = transaction.transaction_type === "Transferencia" &&
    (transaction.transferation_type === "Transferencia a Terceros" || transaction.transferation_type === "Transferencias a Terceros");

  // Get the effective payment reason (use transferation_type for third party transfers)
  const effectivePaymentReason = isTransferToThird ?
    transaction.transferation_type :
    transaction.payment_reason;

  // Check if there's an existing rule for this transaction
  const [applyToAll, setApplyToAll] = useState(() => {
    return categorizationRules.some(rule => rule.payment_reason === effectivePaymentReason);
  });

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

  const handleAmountSubmit = async () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setAmount(transaction.amount.toString());
      setIsEditingAmount(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ amount: numericAmount })
        .eq('Id', transaction.Id);

      if (error) {
        console.error('Error updating amount:', error);
        setAmount(transaction.amount.toString());
      } else {
        // Update the transaction object locally
        transaction.amount = numericAmount;
      }
    } catch (error) {
      console.error('Error updating amount:', error);
      setAmount(transaction.amount.toString());
    }

    setIsEditingAmount(false);
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAmountSubmit();
    } else if (e.key === 'Escape') {
      setAmount(transaction.amount.toString());
      setIsEditingAmount(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    if (currency === 'USD') {
      // Show USD amounts as USD, not converted to CLP
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } else {
      // Show CLP amounts as CLP
      return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
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
              {isEditingAmount ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={handleAmountSubmit}
                    onKeyDown={handleAmountKeyDown}
                    className="w-24 text-right text-lg font-bold"
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {transaction.currency}
                  </span>
                </div>
              ) : (
                <div 
                  className="flex items-baseline gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1"
                  onClick={() => setIsEditingAmount(true)}
                  title="Click to edit amount"
                >
                  <p className="text-lg font-bold text-foreground">
                    {formatAmount(parseFloat(amount), transaction.currency)}
                  </p>
                  <span className="text-xs font-medium text-muted-foreground">
                    {transaction.currency}
                  </span>
                </div>
              )}
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

          {showApplyToAll && (
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