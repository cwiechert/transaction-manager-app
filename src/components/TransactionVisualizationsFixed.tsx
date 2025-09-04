import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, BarChart3, PieChart, TrendingUp } from "lucide-react";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, Tooltip } from 'recharts';
import { VisualizationSettings } from "@/components/VisualizationSettings";

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

interface TransactionVisualizationsProps {
  transactions: Transaction[];
}

export const TransactionVisualizationsFixed = ({ transactions }: TransactionVisualizationsProps) => {
  // Get all unique categories
  const allCategories = [...new Set(transactions.map(t => t.category).filter(Boolean))].sort();
  
  // Default settings
  const defaultExcludedCategories = ["Inversion", "Otros"];
  const initialAvailableCategories = allCategories.filter(cat => !defaultExcludedCategories.includes(cat));
  
  // State management
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialAvailableCategories);
  const [selectedMonths, setSelectedMonths] = useState<number>(3);
  const [categoryChartView, setCategoryChartView] = useState<'filtered' | 'current'>('filtered');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [usdToClp, setUsdToClp] = useState<number>(900);

  // Initialize categories when allCategories changes and no custom settings loaded
  useEffect(() => {
    if (!settingsLoaded && allCategories.length > 0) {
      const availableCategories = allCategories.filter(cat => !defaultExcludedCategories.includes(cat));
      setSelectedCategories(availableCategories);
    }
  }, [allCategories, settingsLoaded]);

  // Fetch USD to CLP rate
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        if (data?.rates?.CLP) setUsdToClp(data.rates.CLP);
      } catch (e) {
        console.warn('Failed to fetch USD->CLP rate, using fallback 950', e);
        setUsdToClp(950);
      }
    })();
  }, []);

  // Handle settings changes from VisualizationSettings component
  const handleSettingsChange = (settings: { defaultMonths: number; defaultCategoryView: 'filtered' | 'current'; defaultExcludedCategories: string[] }) => {
    const availableCategories = allCategories.filter(cat => !settings.defaultExcludedCategories.includes(cat));
    setSelectedCategories(availableCategories);
    setSelectedMonths(settings.defaultMonths);
    setCategoryChartView(settings.defaultCategoryView);
    setSettingsLoaded(true);
  };

  // FIXED: Filter transactions based on selected filters
  const filteredTransactions = transactions.filter(transaction => {
    // Always exclude "Pago de Tarjeta de Crédito"
    if (transaction.category === "Pago de Tarjeta de Crédito") {
      return false;
    }
    
    // FIXED: Only show transactions with categories that are selected
    if (!transaction.category) {
      return false; // Exclude uncategorized transactions
    }
    
    if (selectedCategories.length > 0) {
      if (!selectedCategories.includes(transaction.category)) {
        return false; // Exclude categories not in selection
      }
    }
    
    // Month filter (skip if "All time" is selected)
    if (selectedMonths < 999) {
      const transactionDate = new Date(transaction.transaction_timestamp_local);
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - selectedMonths);
      cutoffDate.setDate(1);
      cutoffDate.setHours(0, 0, 0, 0);
      
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
    .slice(0, 8);

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
    .slice(-6);

  // Calculate summary stats
  const totalSpending = filteredTransactions.reduce((sum, t) => 
    sum + Math.abs(t.currency === 'USD' ? t.amount * usdToClp : t.amount), 0
  );

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

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#ffb347', '#87ceeb'];

  console.log('Debug Filter Info:', {
    totalTransactions: transactions.length,
    allCategories: allCategories.length,
    selectedCategories: selectedCategories.length,
    selectedCategoriesList: selectedCategories,
    selectedMonths,
    filteredTransactions: filteredTransactions.length,
    categoryChartData: categoryChartData.length
  });

  return (
    <div className="space-y-6">
      {/* Default Settings */}
      <VisualizationSettings 
        allCategories={allCategories} 
        onSettingsChange={handleSettingsChange} 
      />
      
      {/* FIXED: Filter Controls with proper Popover */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-card rounded-lg border">
        <div className="space-y-2">
          <Label>Categories</Label>
          <Popover open={categoryDropdownOpen} onOpenChange={setCategoryDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
              >
                {selectedCategories.length === allCategories.filter(cat => !["Inversion", "Otros"].includes(cat)).length 
                  ? "All categories (excluding Inversion & Otros)" 
                  : selectedCategories.length === 0
                    ? "No categories selected"
                    : `${selectedCategories.length} categories selected`
                }
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <div className="p-2 space-y-2 max-h-48 overflow-y-auto">
                <div className="flex items-center space-x-2 p-2 hover:bg-accent rounded">
                  <Checkbox
                    id="all-categories"
                    checked={selectedCategories.length === allCategories.filter(cat => !["Inversion", "Otros"].includes(cat)).length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCategories(allCategories.filter(cat => !["Inversion", "Otros"].includes(cat)));
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(totalSpending)}
            </div>
            <p className="text-xs text-muted-foreground">Total Spending</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(currentMonthSpending)}
            </div>
            <p className="text-xs text-muted-foreground">This Month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className={`text-2xl font-bold ${monthOverMonthChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
              {monthOverMonthChange >= 0 ? '+' : ''}{monthOverMonthChange.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">vs Last Month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold">{filteredTransactions.length}</div>
            <p className="text-xs text-muted-foreground">Transactions</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold">{selectedCategories.length}</div>
            <p className="text-xs text-muted-foreground">Categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Spending Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Category Spending
              <div className="ml-auto">
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
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [
                    new Intl.NumberFormat('es-CL', {
                      style: 'currency',
                      currency: 'CLP',
                      minimumFractionDigits: 0,
                    }).format(value),
                    'Amount'
                  ]} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Monthly Spending Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const [year, month] = value.split('-');
                      return `${month}/${year.slice(-2)}`;
                    }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      return new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        minimumFractionDigits: 0,
                        notation: 'compact'
                      }).format(value);
                    }}
                  />
                  <Tooltip formatter={(value: number) => [
                    new Intl.NumberFormat('es-CL', {
                      style: 'currency',
                      currency: 'CLP',
                      minimumFractionDigits: 0,
                    }).format(value),
                    'Spending'
                  ]} />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={{ fill: '#8884d8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};