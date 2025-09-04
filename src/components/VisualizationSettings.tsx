import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VisualizationDefaultSettings {
  defaultMonths: number;
  defaultCategoryView: 'filtered' | 'current';
  defaultExcludedCategories: string[];
}

interface VisualizationSettingsProps {
  allCategories: string[];
  onSettingsChange: (settings: VisualizationDefaultSettings) => void;
}

const DEFAULT_SETTINGS: VisualizationDefaultSettings = {
  defaultMonths: 3,
  defaultCategoryView: 'filtered',
  defaultExcludedCategories: ["Inversion", "Otros"]
};

export const VisualizationSettings = ({ allCategories, onSettingsChange }: VisualizationSettingsProps) => {
  const [settings, setSettings] = useState<VisualizationDefaultSettings>(DEFAULT_SETTINGS);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Load settings from localStorage on component mount
  useEffect(() => {
    // Small delay to ensure parent component is ready
    const timer = setTimeout(() => {
      const savedSettings = localStorage.getItem('visualization-default-settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSettings(parsed);
          onSettingsChange(parsed);
        } catch (error) {
          console.error('Error parsing saved settings:', error);
          onSettingsChange(DEFAULT_SETTINGS);
        }
      } else {
        onSettingsChange(DEFAULT_SETTINGS);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [onSettingsChange]);

  const handleSaveSettings = () => {
    localStorage.setItem('visualization-default-settings', JSON.stringify(settings));
    onSettingsChange(settings);
    setIsOpen(false);
    toast({
      title: "Settings Saved",
      description: "Default visualization filters have been updated.",
    });
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('visualization-default-settings');
    onSettingsChange(DEFAULT_SETTINGS);
    toast({
      title: "Settings Reset",
      description: "Default visualization filters have been reset.",
    });
  };

  const handleExcludedCategoryChange = (category: string, checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      defaultExcludedCategories: checked
        ? [...prev.defaultExcludedCategories, category]
        : prev.defaultExcludedCategories.filter(cat => cat !== category)
    }));
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
      >
        <Settings className="h-4 w-4" />
        Default Filters
      </Button>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Default Visualization Settings
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            ×
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Default Time Period</Label>
            <Select 
              value={settings.defaultMonths.toString()} 
              onValueChange={(value) => setSettings(prev => ({ ...prev, defaultMonths: parseInt(value) }))}
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

          <div className="space-y-2">
            <Label>Default Category Chart View</Label>
            <Select 
              value={settings.defaultCategoryView} 
              onValueChange={(value: 'filtered' | 'current') => setSettings(prev => ({ ...prev, defaultCategoryView: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="filtered">Filtered Period</SelectItem>
                <SelectItem value="current">Current Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Categories to Exclude by Default</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto border rounded-md p-3">
            {allCategories.map((category) => (
              <div key={category} className="flex items-center space-x-2">
                <Checkbox
                  id={`exclude-${category}`}
                  checked={settings.defaultExcludedCategories.includes(category)}
                  onCheckedChange={(checked) => handleExcludedCategoryChange(category, checked === true)}
                />
                <Label
                  htmlFor={`exclude-${category}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {category}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSaveSettings} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
          <Button variant="outline" onClick={handleResetSettings}>
            Reset to Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};