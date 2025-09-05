import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VisualizationDefaultSettings {
  defaultTimePeriod: number;
  defaultSelectedCategories: string[];
  categoryChartView: 'pie' | 'bar';
}

interface VisualizationSettingsProps {
  categories: string[];
  onSettingsChange: (settings: VisualizationDefaultSettings) => void;
}

const STORAGE_KEY = 'visualizationDefaultSettings';

const defaultSettings: VisualizationDefaultSettings = {
  defaultTimePeriod: 3,
  defaultSelectedCategories: [],
  categoryChartView: 'pie'
};

export const VisualizationSettings = ({ categories, onSettingsChange }: VisualizationSettingsProps) => {
  const [settings, setSettings] = useState<VisualizationDefaultSettings>(defaultSettings);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Filter out excluded categories
  const availableCategories = categories.filter(cat => 
    cat !== 'Inversion' && cat !== 'Otros'
  );

  useEffect(() => {
    // Load settings from localStorage on component mount
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        onSettingsChange(parsed);
      } catch (error) {
        console.error('Failed to parse saved visualization settings:', error);
      }
    } else {
      // Set default to all available categories if no saved settings
      const defaultWithCategories = {
        ...defaultSettings,
        defaultSelectedCategories: availableCategories
      };
      setSettings(defaultWithCategories);
      onSettingsChange(defaultWithCategories);
    }
  }, [categories, onSettingsChange]);

  const saveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      onSettingsChange(settings);
      toast({
        title: "Settings Saved",
        description: "Default visualization filters have been updated",
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  const resetToDefaults = () => {
    const defaultWithCategories = {
      ...defaultSettings,
      defaultSelectedCategories: availableCategories
    };
    setSettings(defaultWithCategories);
    localStorage.removeItem(STORAGE_KEY);
    onSettingsChange(defaultWithCategories);
    toast({
      title: "Settings Reset",
      description: "Default visualization filters have been reset",
    });
  };

  const updateSelectedCategories = (category: string, checked: boolean) => {
    const updatedCategories = checked
      ? [...settings.defaultSelectedCategories, category]
      : settings.defaultSelectedCategories.filter(c => c !== category);
    
    setSettings(prev => ({
      ...prev,
      defaultSelectedCategories: updatedCategories
    }));
  };

  const toggleAllCategories = (checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      defaultSelectedCategories: checked ? availableCategories : []
    }));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          Default Filters
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Default Visualization Filters</CardTitle>
            <p className="text-sm text-muted-foreground">
              Set default filters that will be applied when you open the visualizations tab
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Default Time Period */}
            <div className="space-y-2">
              <Label>Default Time Period</Label>
              <Select 
                value={settings.defaultTimePeriod.toString()} 
                onValueChange={(value) => setSettings(prev => ({ ...prev, defaultTimePeriod: parseInt(value) }))}
              >
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

            {/* Default Chart View */}
            <div className="space-y-2">
              <Label>Default Chart View</Label>
              <Select 
                value={settings.categoryChartView} 
                onValueChange={(value: 'pie' | 'bar') => setSettings(prev => ({ ...prev, categoryChartView: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pie">Pie Chart</SelectItem>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Categories */}
            <div className="space-y-3">
              <Label>Default Selected Categories</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Checkbox
                    id="all-categories-default"
                    checked={settings.defaultSelectedCategories.length === availableCategories.length}
                    onCheckedChange={toggleAllCategories}
                  />
                  <Label htmlFor="all-categories-default" className="text-sm font-medium">
                    Select All Categories
                  </Label>
                </div>
                {availableCategories.map(category => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={`default-category-${category}`}
                      checked={settings.defaultSelectedCategories.includes(category)}
                      onCheckedChange={(checked) => updateSelectedCategories(category, checked as boolean)}
                    />
                    <Label htmlFor={`default-category-${category}`} className="text-sm">
                      {category}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {settings.defaultSelectedCategories.length} of {availableCategories.length} categories selected
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-4 border-t">
              <Button 
                variant="outline" 
                size="sm"
                onClick={resetToDefaults}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button 
                size="sm"
                onClick={saveSettings}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};