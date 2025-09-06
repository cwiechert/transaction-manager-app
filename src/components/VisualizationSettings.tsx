import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserPreferences, VisualizationSettings as SettingsType } from "@/hooks/useUserPreferences";

interface VisualizationSettingsProps {
  categories: string[];
  onSettingsChange: (settings: SettingsType) => void;
}

export const VisualizationSettings = ({ categories, onSettingsChange }: VisualizationSettingsProps) => {
  const { settings, loading, saveSettings: saveToDatabase, resetToDefaults: resetInDatabase } = useUserPreferences();
  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Use all available categories
  const availableCategories = categories;

  // Update local settings when database settings change
  useEffect(() => {
    setLocalSettings(settings);
    onSettingsChange(settings);
  }, [settings, onSettingsChange]);

  // Set default categories when categories list changes and no categories are selected
  useEffect(() => {
    if (!loading && categories.length > 0 && settings.defaultSelectedCategories.length === 0) {
      const defaultWithCategories = {
        ...settings,
        defaultSelectedCategories: availableCategories
      };
      setLocalSettings(defaultWithCategories);
      saveToDatabase(defaultWithCategories);
    }
  }, [categories, settings, availableCategories, loading, saveToDatabase]);

  const saveSettings = async () => {
    try {
      await saveToDatabase(localSettings);
      setIsOpen(false);
      toast({
        title: "Settings Saved",
        description: "Your visualization preferences have been saved across all devices",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  const resetToDefaults = async () => {
    try {
      await resetInDatabase();
      setIsOpen(false);
      toast({
        title: "Settings Reset",
        description: "Your visualization preferences have been reset to defaults",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset settings",
        variant: "destructive",
      });
    }
  };

  const updateSelectedCategories = (category: string, checked: boolean) => {
    const updatedCategories = checked
      ? [...localSettings.defaultSelectedCategories, category]
      : localSettings.defaultSelectedCategories.filter(c => c !== category);
    
    setLocalSettings(prev => ({
      ...prev,
      defaultSelectedCategories: updatedCategories
    }));
  };

  const toggleAllCategories = (checked: boolean) => {
    setLocalSettings(prev => ({
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
                value={localSettings.defaultTimePeriod.toString()} 
                onValueChange={(value) => setLocalSettings(prev => ({ ...prev, defaultTimePeriod: parseInt(value) }))}
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


            {/* Default Categories */}
            <div className="space-y-3">
              <Label>Default Selected Categories</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Checkbox
                    id="all-categories-default"
                    checked={localSettings.defaultSelectedCategories.length === availableCategories.length}
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
                      checked={localSettings.defaultSelectedCategories.includes(category)}
                      onCheckedChange={(checked) => updateSelectedCategories(category, checked as boolean)}
                    />
                    <Label htmlFor={`default-category-${category}`} className="text-sm">
                      {category}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {localSettings.defaultSelectedCategories.length} of {availableCategories.length} categories selected
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