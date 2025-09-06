import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface VisualizationSettings {
  defaultTimePeriod: number;
  defaultSelectedCategories: string[];
}

export const useUserPreferences = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<VisualizationSettings>({
    defaultTimePeriod: 3,
    defaultSelectedCategories: []
  });
  const [loading, setLoading] = useState(true);

  // Load preferences from database
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('visualization_settings')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
          console.error('Error loading preferences:', error);
        } else if (data && data.visualization_settings) {
          setSettings(data.visualization_settings as unknown as VisualizationSettings);
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user]);

  // Save preferences to database
  const saveSettings = async (newSettings: VisualizationSettings) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          visualization_settings: newSettings as any
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving preferences:', error);
        throw error;
      }

      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving preferences:', error);
      throw error;
    }
  };

  // Reset to defaults
  const resetToDefaults = async () => {
    const defaultSettings = {
      defaultTimePeriod: 3,
      defaultSelectedCategories: []
    };

    if (!user) {
      setSettings(defaultSettings);
      return;
    }

    try {
      const { error } = await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error resetting preferences:', error);
        throw error;
      }

      setSettings(defaultSettings);
    } catch (error) {
      console.error('Error resetting preferences:', error);
      throw error;
    }
  };

  return {
    settings,
    loading,
    saveSettings,
    resetToDefaults
  };
};